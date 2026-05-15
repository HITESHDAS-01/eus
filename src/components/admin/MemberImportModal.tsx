import { useEffect, useRef, useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/basic';
import { branding, locale } from '../../config/branding';

// ---------------------------------------------------------------------------
// MemberImportModal
// ---------------------------------------------------------------------------
// A 3-step bulk-import flow for member records from Excel/CSV:
//   1. Download a sample template + pick a file.
//   2. Parse + validate every row client-side; show a preview table with
//      per-row status (valid / warning / error). Admin can choose to import
//      only the valid rows, or fix the file and re-upload.
//   3. Run the admin-create-member Edge Function in parallel batches with a
//      progress bar, then show a results screen: success rows with their
//      generated passwords (for sharing with members) and failed rows
//      downloadable as Excel for re-upload after fixing.
// ---------------------------------------------------------------------------

type Category = 'A' | 'B' | 'C';
type Status = 'active' | 'inactive' | 'matured' | 'withdrawn' | 'closed';

type ParsedRow = {
  rowNumber: number; // 1-based row number from the source sheet (for error messages)
  full_name: string;
  phone: string | null;
  member_code: string | null;
  category: Category;
  initial_investment: number;
  monthly_installment: number | null;
  chosen_term_months: number | null;
  status: Status;
  join_date: string; // yyyy-MM-dd
  password: string;
  generatedPassword: boolean; // true if we auto-filled because the column was empty
  warnings: string[];
  errors: string[];
};

type ImportResult = {
  row: ParsedRow;
  ok: boolean;
  member_code?: string;
  error?: string;
};

const PARALLEL_BATCH_SIZE = 5;

async function callEdgeFunction<T>(name: string, payload: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(body?.error || `${name} failed (${resp.status})`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Column aliases — accept lots of casing/spelling variants from real-world files.
// ---------------------------------------------------------------------------
const COL = {
  full_name: ['full name', 'name', 'member name', 'নাম'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'ফোন'],
  member_code: ['member id', 'member code', 'id', 'code'],
  category: ['category', 'cat', 'class', 'শ্রেণী'],
  initial_investment: ['initial investment', 'investment', 'principal', 'deposit'],
  monthly_installment: ['monthly installment', 'instalment', 'installment', 'monthly'],
  chosen_term_months: ['term', 'term months', 'duration', 'months'],
  status: ['status', 'state'],
  join_date: ['join date', 'joining date', 'date', 'start date'],
  password: ['password', 'pwd', 'pin'],
};

function findColumn(row: Record<string, unknown>, aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const match = keys.find((k) => k.trim().toLowerCase() === alias);
    if (match !== undefined) return row[match];
  }
  return undefined;
}

function parseExcelDate(value: unknown): string | null {
  if (value == null || value === '') return null;

  // Excel stores dates as days-since-1899-12-30. Numeric values come straight
  // through sheet_to_json.
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = excelEpoch.getTime() + value * 86400000;
    const d = new Date(ms);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');
    return null;
  }

  if (typeof value === 'string') {
    const str = value.trim();
    // Try common formats. Most Indian users type dd/MM/yyyy or dd-MM-yyyy.
    const candidates = [
      'yyyy-MM-dd', 'yyyy/MM/dd',
      'dd-MM-yyyy', 'dd/MM/yyyy', 'dd.MM.yyyy',
      'MM-dd-yyyy', 'MM/dd/yyyy',
      'd-M-yyyy', 'd/M/yyyy',
    ];
    for (const fmt of candidates) {
      const parsed = parse(str, fmt, new Date());
      if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
    }
    // Last resort: let Date constructor try (handles ISO).
    const fallback = new Date(str);
    if (isValid(fallback)) return format(fallback, 'yyyy-MM-dd');
  }

  return null;
}

function normalizePhone(value: unknown): string | null {
  if (value == null || value === '') return null;
  const digits = String(value).replace(/\D+/g, '');
  if (digits.length === 0) return null;
  // Strip leading country code "91" if the result is 10+ digits (common
  // Indian format "+91 98765 43210" → "9876543210").
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function generatePassword(): string {
  // 8 chars from an unambiguous alphabet (no 0/O/1/l/I).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function parseRow(raw: Record<string, unknown>, rowNumber: number, autoPasswords: boolean): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const full_name = String(findColumn(raw, COL.full_name) ?? '').trim();
  if (!full_name) errors.push('Full name is required');

  const phone = normalizePhone(findColumn(raw, COL.phone));
  if (phone && phone.length < 7) warnings.push(`Phone "${phone}" looks too short`);

  const codeRaw = findColumn(raw, COL.member_code);
  const member_code = codeRaw ? String(codeRaw).trim() : null;

  const catRaw = String(findColumn(raw, COL.category) ?? 'C').trim().toUpperCase();
  const category: Category = (catRaw === 'A' || catRaw === 'B' || catRaw === 'C') ? catRaw : 'C';
  if (!['A', 'B', 'C'].includes(catRaw)) warnings.push(`Unknown category "${catRaw}", defaulted to C`);

  const initial_investment = Number(findColumn(raw, COL.initial_investment) ?? 0);
  if (Number.isNaN(initial_investment) || initial_investment < 0) {
    errors.push('Initial investment must be a non-negative number');
  }

  const installmentRaw = findColumn(raw, COL.monthly_installment);
  const monthly_installment = installmentRaw != null && installmentRaw !== ''
    ? Number(installmentRaw)
    : (category === 'A' ? 1000 : category === 'C' ? 100 : null);
  if (monthly_installment !== null && (Number.isNaN(monthly_installment) || monthly_installment < 0)) {
    errors.push('Monthly installment must be a non-negative number');
  }

  const termRaw = findColumn(raw, COL.chosen_term_months);
  let chosen_term_months: number | null = termRaw != null && termRaw !== '' ? Number(termRaw) : null;
  if (chosen_term_months !== null && (Number.isNaN(chosen_term_months) || chosen_term_months < 0)) {
    errors.push('Term months must be a non-negative number');
    chosen_term_months = null;
  }
  // Cat B is always 36 months by business rule.
  if (category === 'B') chosen_term_months = 36;
  if (chosen_term_months == null) {
    chosen_term_months = category === 'C' ? 24 : null;
    if (category === 'C') warnings.push('Term not given, defaulted to 24 months');
  }

  const statusRaw = String(findColumn(raw, COL.status) ?? 'active').trim().toLowerCase();
  const validStatuses: Status[] = ['active', 'inactive', 'matured', 'withdrawn', 'closed'];
  const status: Status = (validStatuses as string[]).includes(statusRaw) ? (statusRaw as Status) : 'active';
  if (!(validStatuses as string[]).includes(statusRaw)) warnings.push(`Unknown status "${statusRaw}", defaulted to active`);

  const join_date_raw = findColumn(raw, COL.join_date);
  const join_date = parseExcelDate(join_date_raw) ?? format(new Date(), 'yyyy-MM-dd');
  if (join_date_raw && !parseExcelDate(join_date_raw)) {
    warnings.push(`Could not parse join date "${join_date_raw}", using today`);
  }

  const passwordRaw = String(findColumn(raw, COL.password) ?? '').trim();
  let password = passwordRaw;
  let generatedPassword = false;
  if (!password) {
    if (autoPasswords) {
      password = generatePassword();
      generatedPassword = true;
    } else {
      errors.push('Password is required (or enable auto-generate)');
    }
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  return {
    rowNumber,
    full_name,
    phone,
    member_code,
    category,
    initial_investment,
    monthly_installment,
    chosen_term_months,
    status,
    join_date,
    password,
    generatedPassword,
    warnings,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = 'pick' | 'preview' | 'importing' | 'done';

export function MemberImportModal({ isOpen, onClose, onImportComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [parsing, setParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [autoPasswords, setAutoPasswords] = useState(true);
  const [overwriteWarnings, setOverwriteWarnings] = useState(false);

  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset on open.
      setStep('pick');
      setParsedRows([]);
      setResults([]);
      setProgressDone(0);
      setProgressTotal(0);
      setFileError(null);
    }
  }, [isOpen]);

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const sample = [
      {
        'Full Name': 'Rahul Sharma',
        'Phone': '9876543210',
        'Category': 'C',
        'Initial Investment': 0,
        'Monthly Installment': 100,
        'Term Months': 24,
        'Join Date': '01/01/2026',
        'Status': 'active',
        'Password': '',
        'Member ID': '',
      },
      {
        'Full Name': 'Priya Investor',
        'Phone': '9876500000',
        'Category': 'B',
        'Initial Investment': 50000,
        'Monthly Installment': '',
        'Term Months': 36,
        'Join Date': '15/02/2026',
        'Status': 'active',
        'Password': '',
        'Member ID': '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    // Add an instructions sheet so admins know what each column does.
    const instructions = [
      { Column: 'Full Name', Required: 'Yes', Notes: 'Member full name' },
      { Column: 'Phone', Required: 'No', Notes: '10-digit Indian mobile. Country codes auto-stripped.' },
      { Column: 'Category', Required: 'Yes', Notes: 'A (founder), B (investor), or C (public). Defaults to C.' },
      { Column: 'Initial Investment', Required: 'For A/B', Notes: `One-time deposit in ${locale.currencySymbol}. For Cat A & B.` },
      { Column: 'Monthly Installment', Required: 'For A/C', Notes: `Recurring monthly deposit in ${locale.currencySymbol}.` },
      { Column: 'Term Months', Required: 'For C', Notes: '24 or 36. Cat B is always 36.' },
      { Column: 'Join Date', Required: 'No', Notes: 'DD/MM/YYYY (e.g. 15/01/2026). Defaults to today.' },
      { Column: 'Status', Required: 'No', Notes: 'active, inactive, matured, withdrawn, closed. Defaults to active.' },
      { Column: 'Password', Required: 'No', Notes: 'Min 6 chars. Leave blank to auto-generate during import.' },
      { Column: 'Member ID', Required: 'No', Notes: 'Leave blank to auto-generate via the system rule.' },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
    XLSX.writeFile(wb, `${branding.orgShort}_Member_Import_Template.xlsx`);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileError(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Use the first non-empty sheet (skip Instructions if it comes first).
      let rawRows: Record<string, unknown>[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
        if (data.length > 0 && Object.keys(data[0]).some((k) => /name|member/i.test(k))) {
          rawRows = data;
          break;
        }
      }
      if (rawRows.length === 0) {
        throw new Error('No data rows found. Make sure column headers are in the first row.');
      }
      // 2 = data starts on Excel row 2 (header is row 1).
      const parsed = rawRows.map((r, i) => parseRow(r, i + 2, autoPasswords));
      setParsedRows(parsed);
      setStep('preview');
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);
  const warningRows = parsedRows.filter((r) => r.errors.length === 0 && r.warnings.length > 0);
  const canProceed = validRows.length > 0 && (warningRows.length === 0 || overwriteWarnings);

  const runImport = async () => {
    setStep('importing');
    setProgressTotal(validRows.length);
    setProgressDone(0);
    const out: ImportResult[] = [];

    // Process in parallel batches so 200 rows doesn't take 100 seconds.
    for (let i = 0; i < validRows.length; i += PARALLEL_BATCH_SIZE) {
      const batch = validRows.slice(i, i + PARALLEL_BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (row) => {
        try {
          const resp = await callEdgeFunction<{ member_code: string }>('admin-create-member', {
            full_name: row.full_name,
            phone: row.phone,
            member_code: row.member_code,
            category: row.category,
            initial_investment: row.initial_investment,
            monthly_installment: row.monthly_installment,
            chosen_term_months: row.chosen_term_months,
            join_date: row.join_date,
            password: row.password,
          });
          return { row, ok: true, member_code: resp.member_code } as ImportResult;
        } catch (err) {
          return { row, ok: false, error: err instanceof Error ? err.message : 'unknown' } as ImportResult;
        }
      }));
      out.push(...batchResults);
      setProgressDone(out.length);
    }

    setResults(out);
    setStep('done');
    onImportComplete();
  };

  const downloadCredentials = async () => {
    const XLSX = await import('xlsx');
    const rows = results
      .filter((r) => r.ok)
      .map((r) => ({
        'Full Name': r.row.full_name,
        'Member ID': r.member_code ?? '',
        'Password': r.row.password,
        'Phone': r.row.phone ?? '',
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credentials');
    XLSX.writeFile(wb, `${branding.orgShort}_Member_Credentials_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const downloadFailedRows = async () => {
    const XLSX = await import('xlsx');
    const rows = results
      .filter((r) => !r.ok)
      .map((r) => ({
        'Full Name': r.row.full_name,
        'Phone': r.row.phone ?? '',
        'Category': r.row.category,
        'Initial Investment': r.row.initial_investment,
        'Monthly Installment': r.row.monthly_installment ?? '',
        'Term Months': r.row.chosen_term_months ?? '',
        'Join Date': r.row.join_date,
        'Status': r.row.status,
        'Password': r.row.password,
        'Member ID': r.row.member_code ?? '',
        'Error': r.error ?? 'unknown',
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Failed');
    XLSX.writeFile(wb, `${branding.orgShort}_Member_Import_Failures_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  if (!isOpen) return null;

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white shrink-0">
          <h3 className="font-bold text-lg">
            {step === 'pick' && 'Bulk Import Members'}
            {step === 'preview' && `Preview — ${parsedRows.length} rows`}
            {step === 'importing' && `Importing ${progressDone} / ${progressTotal}…`}
            {step === 'done' && 'Import complete'}
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 'pick' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
                <p className="font-bold mb-1">How this works</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-800">
                  <li>Download the template, fill in your members, save as .xlsx</li>
                  <li>Upload the file — we'll show you a preview before anything is saved</li>
                  <li>Review warnings, then click Import. You'll get an Excel with all generated passwords.</li>
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2 flex-1">
                  <i className="fas fa-file-download"></i> Download Template
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={parsing} className="gap-2 flex-1">
                  <i className="fas fa-file-excel"></i> {parsing ? 'Reading…' : 'Choose Excel File'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoPasswords}
                  onChange={(e) => setAutoPasswords(e.target.checked)}
                  className="w-4 h-4"
                />
                Auto-generate passwords for rows where the Password column is empty
              </label>

              {fileError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {fileError}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                  {validRows.length - warningRows.length} ready
                </span>
                {warningRows.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                    {warningRows.length} with warnings
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-medium">
                    {errorRows.length} with errors (skipped)
                  </span>
                )}
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-600">
                      <th className="p-2 font-medium">Row</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Name</th>
                      <th className="p-2 font-medium">Cat</th>
                      <th className="p-2 font-medium">Phone</th>
                      <th className="p-2 font-medium text-right">Initial</th>
                      <th className="p-2 font-medium text-right">Monthly</th>
                      <th className="p-2 font-medium">Term</th>
                      <th className="p-2 font-medium">Join Date</th>
                      <th className="p-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map((row, idx) => {
                      const hasError = row.errors.length > 0;
                      const hasWarning = !hasError && row.warnings.length > 0;
                      const rowClass = hasError
                        ? 'bg-red-50'
                        : hasWarning
                        ? 'bg-yellow-50'
                        : '';
                      return (
                        <tr key={idx} className={rowClass}>
                          <td className="p-2 text-gray-500">{row.rowNumber}</td>
                          <td className="p-2">
                            {hasError ? (
                              <span className="text-red-600 font-medium"><i className="fas fa-times-circle"></i></span>
                            ) : hasWarning ? (
                              <span className="text-yellow-600 font-medium"><i className="fas fa-exclamation-triangle"></i></span>
                            ) : (
                              <span className="text-green-600"><i className="fas fa-check-circle"></i></span>
                            )}
                          </td>
                          <td className="p-2 text-gray-800">{row.full_name || <span className="text-gray-400 italic">missing</span>}</td>
                          <td className="p-2">{row.category}</td>
                          <td className="p-2 font-mono text-xs">{row.phone ?? '-'}</td>
                          <td className="p-2 text-right">{row.initial_investment}</td>
                          <td className="p-2 text-right">{row.monthly_installment ?? '-'}</td>
                          <td className="p-2">{row.chosen_term_months ?? '-'}</td>
                          <td className="p-2 text-xs">{row.join_date}</td>
                          <td className="p-2 text-xs text-gray-600">
                            {row.errors.length > 0 && (
                              <span className="text-red-700">{row.errors.join('; ')}</span>
                            )}
                            {row.errors.length === 0 && row.warnings.length > 0 && (
                              <span className="text-yellow-700">{row.warnings.join('; ')}</span>
                            )}
                            {row.generatedPassword && (
                              <span className="text-blue-700 block">Password will be auto-generated</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {warningRows.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-yellow-900 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <input
                    type="checkbox"
                    checked={overwriteWarnings}
                    onChange={(e) => setOverwriteWarnings(e.target.checked)}
                    className="w-4 h-4"
                  />
                  I have reviewed the warnings and want to import these rows anyway
                </label>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={() => setStep('pick')} variant="outline" className="gap-2">
                  <i className="fas fa-arrow-left"></i> Back
                </Button>
                <Button
                  onClick={runImport}
                  disabled={!canProceed}
                  className="gap-2 flex-1 disabled:opacity-60"
                >
                  <i className="fas fa-cloud-upload-alt"></i>
                  Import {validRows.length - (overwriteWarnings ? 0 : warningRows.length)} members
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-[#1e5a48] mb-4"></i>
                <p className="text-lg font-medium text-gray-800">
                  Importing {progressDone} of {progressTotal} members…
                </p>
                <p className="text-sm text-gray-500 mt-1">Please don't close this window.</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#1e5a48] h-3 transition-all duration-200"
                  style={{ width: `${progressTotal === 0 ? 0 : (progressDone / progressTotal) * 100}%` }}
                />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">
                  ✓ {successCount} imported
                </span>
                {failCount > 0 && (
                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-medium">
                    ✗ {failCount} failed
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {successCount > 0 && (
                  <Button onClick={downloadCredentials} variant="outline" className="gap-2 flex-1">
                    <i className="fas fa-key"></i> Download Credentials (.xlsx)
                  </Button>
                )}
                {failCount > 0 && (
                  <Button onClick={downloadFailedRows} variant="outline" className="gap-2 flex-1 border-red-300 text-red-700">
                    <i className="fas fa-file-excel"></i> Download Failed Rows (.xlsx)
                  </Button>
                )}
              </div>

              {failCount > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 sticky top-0">
                      <tr className="text-left text-red-800">
                        <th className="p-2 font-medium">Row</th>
                        <th className="p-2 font-medium">Name</th>
                        <th className="p-2 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {results.filter((r) => !r.ok).map((r, i) => (
                        <tr key={i}>
                          <td className="p-2">{r.row.rowNumber}</td>
                          <td className="p-2">{r.row.full_name}</td>
                          <td className="p-2 text-red-700 text-xs">{r.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
