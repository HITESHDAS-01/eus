import { useEffect, useMemo, useState } from 'react';
import { format, getDate, startOfMonth, setDate, addMonths, startOfYear, endOfYear } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../ui/basic';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../lib/AuthContext';

type PenaltySettings = { percentage: number; dueDay: number; gracePeriod: number };

type Member = {
  id: string;
  member_code: string;
  category: string;
  join_date: string;
  monthly_installment: number | null;
  profiles: { full_name: string | null } | null;
};

type PreviewRow = {
  member: Member;
  monthYear: string;
  amount: number;
  penalty: number;
  dueDate: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  members: Member[];
  penaltySettings: PenaltySettings;
}

type Step = 'configure' | 'select-members' | 'preview' | 'importing' | 'done';

function getAvailableMonths(): { label: string; value: string }[] {
  const now = new Date();
  const start = startOfMonth(new Date(now.getFullYear(), 0, 1));
  const months: { label: string; value: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = addMonths(start, i);
    months.push({
      label: format(d, 'MMMM yyyy'),
      value: format(d, 'yyyy-MM'),
    });
  }
  return months;
}

function computePenalty(amount: number, category: string, paymentDay: number, settings: PenaltySettings): number {
  if (category !== 'C') return 0;
  if (paymentDay > settings.dueDay + settings.gracePeriod) {
    return (amount * settings.percentage) / 100;
  }
  return 0;
}

function generateReceipt(memberCode: string, monthYear: string, seq: number): string {
  const short = memberCode.split('/').pop() || '000';
  return `RCPT-${monthYear.replace(/-/g, '')}-${short}-${String(seq).padStart(3, '0')}`;
}

export function BulkInstallmentModal({ isOpen, onClose, onComplete, members, penaltySettings }: Props) {
  const { user } = useAuth();
  const availableMonths = useMemo(() => getAvailableMonths(), []);
  const [step, setStep] = useState<Step>('configure');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [existingCombos, setExistingCombos] = useState<Set<string>>(new Set());
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [results, setResults] = useState<{ ok: number; failed: number; errors: string[] }>({ ok: 0, failed: 0, errors: [] });

  useEffect(() => {
    if (isOpen) {
      setStep('configure');
      setSelectedMonths([]);
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setSelectedMemberIds(new Set(members.map(m => m.id)));
      setExistingCombos(new Set());
      setProgressDone(0);
      setProgressTotal(0);
      setResults({ ok: 0, failed: 0, errors: [] });
    }
  }, [isOpen, members]);

  const paymentDay = paymentDate ? getDate(new Date(paymentDate)) : 0;

  const previewRows = useMemo(() => {
    const rows: PreviewRow[] = [];
    const sorted = [...members].sort((a, b) => (a.member_code || '').localeCompare(b.member_code || ''));
    for (const member of sorted) {
      if (!selectedMemberIds.has(member.id)) continue;
      if (!member.monthly_installment || member.monthly_installment <= 0) continue;
      const joinMonth = format(new Date(member.join_date), 'yyyy-MM');
      for (const monthStr of selectedMonths) {
        if (monthStr < joinMonth) continue;
        const monthYearDate = startOfMonth(new Date(`${monthStr}-01`));
        const dueDate = setDate(monthYearDate, penaltySettings.dueDay);
        const amount = member.monthly_installment;
        const penalty = computePenalty(amount, member.category, paymentDay, penaltySettings);
        rows.push({ member, monthYear: format(monthYearDate, 'yyyy-MM-dd'), amount, penalty, dueDate: format(dueDate, 'yyyy-MM-dd') });
      }
    }
    return rows;
  }, [members, selectedMonths, selectedMemberIds, paymentDay, penaltySettings]);

  const filteredRows = useMemo(() => {
    return previewRows.filter(row => !existingCombos.has(`${row.member.id}_${row.monthYear}`));
  }, [previewRows, existingCombos]);

  const skippedCount = previewRows.length - filteredRows.length;
  const totalAmount = filteredRows.reduce((s, r) => s + r.amount + r.penalty, 0);

  const checkDuplicates = async () => {
    if (selectedMonths.length === 0 || selectedMemberIds.size === 0) return;
    const dates = selectedMonths.map(m => format(startOfMonth(new Date(`${m}-01`)), 'yyyy-MM-dd'));
    const ids = [...selectedMemberIds];
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 50) {
      const { data } = await supabase.from('savings_installments').select('member_id, month_year').in('member_id', ids.slice(i, i + 50)).in('month_year', dates);
      if (data) data.forEach(r => existing.add(`${r.member_id}_${r.month_year}`));
    }
    setExistingCombos(existing);
  };

  const runImport = async () => {
    setStep('importing');
    setProgressTotal(filteredRows.length);
    setProgressDone(0);
    let ok = 0, failed = 0;
    const errors: string[] = [];
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      try {
        const insertData: Record<string, unknown> = {
          member_id: row.member.id,
          amount: row.amount,
          penalty: row.penalty,
          payment_date: paymentDate,
          due_date: row.dueDate,
          receipt_number: generateReceipt(row.member.member_code, row.monthYear.substring(0, 7), i + 1),
          month_year: row.monthYear,
        };
        if (user?.id && user.id.length > 20) insertData.created_by = user.id;
        const { error } = await supabase.from('savings_installments').insert(insertData);
        if (error) throw error;
        ok++;
      } catch (err) {
        failed++;
        errors.push(`${row.member.profiles?.full_name} (${row.monthYear.substring(0, 7)}): ${err instanceof Error ? err.message : 'unknown'}`);
      }
      setProgressDone(i + 1);
    }
    setResults({ ok, failed, errors });
    setStep('done');
    onComplete();
  };

  const toggleMonth = (v: string) => setSelectedMonths(p => p.includes(v) ? p.filter(m => m !== v) : [...p, v]);
  const toggleAllMonths = () => setSelectedMonths(p => p.length === availableMonths.length ? [] : availableMonths.map(m => m.value));
  const toggleMember = (id: string) => setSelectedMemberIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllMembers = () => setSelectedMemberIds(p => p.size === members.length ? new Set() : new Set(members.map(m => m.id)));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white shrink-0">
          <h3 className="font-bold text-lg">
            {step === 'configure' && 'Bulk Record Installments'}
            {step === 'select-members' && 'Select Members'}
            {step === 'preview' && `Preview \u2014 ${filteredRows.length} installments`}
            {step === 'importing' && `Recording ${progressDone} / ${progressTotal}\u2026`}
            {step === 'done' && 'Import Complete'}
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><i className="fas fa-times text-xl"></i></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 'configure' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold">Select Months</Label>
                  <button onClick={toggleAllMonths} className="text-xs text-[#1e5a48] hover:underline">{selectedMonths.length === availableMonths.length ? 'Deselect All' : 'Select All'}</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {availableMonths.map(m => (
                    <label key={m.value} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${selectedMonths.includes(m.value) ? 'bg-[#1e5a48]/5 border-[#1e5a48] text-[#1e5a48]' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <input type="checkbox" checked={selectedMonths.includes(m.value)} onChange={() => toggleMonth(m.value)} className="w-4 h-4 rounded" />
                      <span className="text-sm font-medium">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="max-w-xs">
                <Label className="text-sm font-semibold mb-2 block">Payment Date (same for all)</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Penalty of {penaltySettings.percentage}% auto-applies if after the {penaltySettings.dueDay + penaltySettings.gracePeriod}th.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => setStep('select-members')} disabled={selectedMonths.length === 0} className="gap-2">Next: Select Members <i className="fas fa-arrow-right"></i></Button>
              </div>
            </div>
          )}

          {step === 'select-members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{selectedMemberIds.size} of {members.length} members selected</p>
                <button onClick={toggleAllMembers} className="text-xs text-[#1e5a48] hover:underline">{selectedMemberIds.size === members.length ? 'Deselect All' : 'Select All'}</button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-600">
                      <th className="p-3 font-medium w-10"><input type="checkbox" checked={selectedMemberIds.size === members.length} onChange={toggleAllMembers} className="w-4 h-4" /></th>
                      <th className="p-3 font-medium">Member Code</th>
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Cat</th>
                      <th className="p-3 font-medium">Join Date</th>
                      <th className="p-3 font-medium text-right">Monthly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {members.map(m => {
                      const joinMonth = format(new Date(m.join_date), 'yyyy-MM');
                      if (selectedMonths.length > 0 && selectedMonths.every(ms => ms < joinMonth)) return null;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="p-3"><input type="checkbox" checked={selectedMemberIds.has(m.id)} onChange={() => toggleMember(m.id)} className="w-4 h-4" /></td>
                          <td className="p-3 font-mono text-xs text-[#1e5a48]">{m.member_code}</td>
                          <td className="p-3 font-medium">{m.profiles?.full_name}</td>
                          <td className="p-3">{m.category}</td>
                          <td className="p-3 text-xs">{m.join_date}</td>
                          <td className="p-3 text-right">{formatCurrency(m.monthly_installment || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('configure')} className="gap-2"><i className="fas fa-arrow-left"></i> Back</Button>
                <Button onClick={async () => { await checkDuplicates(); setStep('preview'); }} disabled={selectedMemberIds.size === 0} className="gap-2">Next: Preview <i className="fas fa-arrow-right"></i></Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">{filteredRows.length} to record</span>
                {skippedCount > 0 && <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">{skippedCount} already recorded (skipped)</span>}
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">Total: {formatCurrency(totalAmount)}</span>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-gray-600">
                      <th className="p-3 font-medium">#</th>
                      <th className="p-3 font-medium">Member</th>
                      <th className="p-3 font-medium">Month</th>
                      <th className="p-3 font-medium text-right">Amount</th>
                      <th className="p-3 font-medium text-right">Penalty</th>
                      <th className="p-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-500">{idx + 1}</td>
                        <td className="p-3"><span className="font-medium">{row.member.profiles?.full_name}</span><span className="text-xs text-gray-500 ml-2 font-mono">{row.member.member_code}</span></td>
                        <td className="p-3 text-xs">{format(new Date(row.monthYear), 'MMM yyyy')}</td>
                        <td className="p-3 text-right">{formatCurrency(row.amount)}</td>
                        <td className="p-3 text-right">{row.penalty > 0 ? formatCurrency(row.penalty) : '-'}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(row.amount + row.penalty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('select-members')} className="gap-2"><i className="fas fa-arrow-left"></i> Back</Button>
                <Button onClick={runImport} disabled={filteredRows.length === 0} className="gap-2"><i className="fas fa-cloud-upload-alt"></i> Record {filteredRows.length} Installments</Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-[#1e5a48] mb-4"></i>
                <p className="text-lg font-medium text-gray-800">Recording {progressDone} of {progressTotal} installments...</p>
                <p className="text-sm text-gray-500 mt-1">Please don't close this window.</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-[#1e5a48] h-3 transition-all duration-200" style={{ width: `${progressTotal === 0 ? 0 : (progressDone / progressTotal) * 100}%` }} />
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 font-medium">{results.ok} recorded</span>
                {results.failed > 0 && <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-medium">{results.failed} failed</span>}
              </div>
              {results.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 sticky top-0"><tr className="text-left text-red-800"><th className="p-3 font-medium">Error</th></tr></thead>
                    <tbody className="divide-y divide-red-100">
                      {results.errors.map((err, i) => <tr key={i}><td className="p-3 text-red-700 text-xs">{err}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="pt-2 flex justify-end"><Button onClick={onClose}>Close</Button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
