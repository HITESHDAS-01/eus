import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, differenceInCalendarDays, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, safeFormatDate } from '../../../lib/utils';
import { Button } from '../../../components/ui/basic';
import { branding } from '../../../config/branding';

// ---------------------------------------------------------------------------
// EMI Dashboard — operational view of the Product EMI portfolio.
// All metrics are computed client-side from emi_loans + emi_payments because
// the volume is small (admin app) and DB views/RPCs would be over-engineering.
// ---------------------------------------------------------------------------

type Loan = {
  id: string;
  loan_code: string;
  customer_id: string;
  product_name: string;
  vendor_paid_amount: number;
  financed_amount: number;
  emi_amount: number;
  tenure_months: number;
  first_emi_date: string;
  remaining_principal: number;
  status: 'active' | 'closed' | 'defaulted' | 'foreclosed';
  emi_customers: { customer_code: string; full_name: string } | null;
};

type Payment = {
  id: string;
  loan_id: string;
  amount_paid: number;
  payment_date: string;
  due_date: string;
  month_year: string;
  receipt_number: string;
  emi_loans?: {
    loan_code: string;
    product_name: string;
    emi_customers: { full_name: string } | null;
  } | null;
};

type OverdueRow = {
  loanId: string;
  loanCode: string;
  customerName: string;
  customerCode: string;
  productName: string;
  emiAmount: number;
  unpaidCount: number;
  overdueAmount: number;
  earliestDueDate: Date;
  daysOverdue: number;
};

export function EmiDashboard() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [gracePeriod, setGracePeriod] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loanRes, payRes, recentRes, settingsRes] = await Promise.all([
        supabase
          .from('emi_loans')
          .select('id, loan_code, customer_id, product_name, vendor_paid_amount, financed_amount, emi_amount, tenure_months, first_emi_date, remaining_principal, status, emi_customers(customer_code, full_name)'),
        supabase
          .from('emi_payments')
          .select('id, loan_id, amount_paid, payment_date, due_date, month_year, receipt_number'),
        supabase
          .from('emi_payments')
          .select('id, loan_id, amount_paid, payment_date, due_date, month_year, receipt_number, emi_loans(loan_code, product_name, emi_customers(full_name))')
          .order('payment_date', { ascending: false })
          .limit(10),
        supabase.from('settings').select('*').eq('key', 'grace_period_days'),
      ]);

      if (loanRes.error)   throw loanRes.error;
      if (payRes.error)    throw payRes.error;
      if (recentRes.error) throw recentRes.error;

      setLoans((loanRes.data as unknown as Loan[]) || []);
      setPayments(payRes.data || []);
      setRecentPayments((recentRes.data as unknown as Payment[]) || []);

      if (settingsRes.data?.[0]) {
        const gp = Number(settingsRes.data[0].value);
        if (!isNaN(gp)) setGracePeriod(gp);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // -------- Metrics ----------------------------------------------------------
  const totalDisbursed   = loans.reduce((s, l) => s + Number(l.vendor_paid_amount), 0);
  const outstanding      = loans.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.remaining_principal), 0);
  const totalCollected   = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const activeCount      = loans.filter(l => l.status === 'active').length;
  const closedCount      = loans.filter(l => l.status === 'closed').length;
  const foreclosedCount  = loans.filter(l => l.status === 'foreclosed').length;
  const defaultedCount   = loans.filter(l => l.status === 'defaulted').length;

  // This month
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const thisMonthKey = format(today, 'yyyy-MM');

  const expectedEmiThisMonth = loans
    .filter(l => l.status === 'active')
    .reduce((sum, l) => {
      // Count how many EMIs in this loan's schedule fall in this calendar month
      const first = new Date(l.first_emi_date);
      let count = 0;
      for (let i = 0; i < l.tenure_months; i++) {
        const due = addMonths(first, i);
        if (due >= monthStart && due <= monthEnd) count++;
      }
      return sum + count * Number(l.emi_amount);
    }, 0);

  const collectedThisMonth = payments
    .filter(p => format(new Date(p.payment_date), 'yyyy-MM') === thisMonthKey)
    .reduce((s, p) => s + Number(p.amount_paid), 0);

  const collectionRate = expectedEmiThisMonth > 0
    ? Math.round((collectedThisMonth / expectedEmiThisMonth) * 100)
    : 0;

  // -------- Overdue calculation ---------------------------------------------
  // For each active loan, walk through the schedule. Any EMI whose
  // due_date + grace < today and no matching payment row → overdue.
  const overdueRows: OverdueRow[] = [];
  for (const l of loans.filter(x => x.status === 'active')) {
    const first = new Date(l.first_emi_date);
    const loanPayments = payments.filter(p => p.loan_id === l.id);
    let unpaid: Date[] = [];
    for (let i = 0; i < l.tenure_months; i++) {
      const due = addMonths(first, i);
      const dueKey = format(due, 'yyyy-MM');
      const matched = loanPayments.some(p => format(new Date(p.due_date), 'yyyy-MM') === dueKey);
      if (!matched) {
        const gracedEnd = new Date(due);
        gracedEnd.setDate(gracedEnd.getDate() + gracePeriod);
        if (today > gracedEnd) unpaid.push(due);
      }
    }
    if (unpaid.length > 0) {
      const earliest = unpaid[0];
      overdueRows.push({
        loanId: l.id,
        loanCode: l.loan_code,
        customerName: l.emi_customers?.full_name || '—',
        customerCode: l.emi_customers?.customer_code || '',
        productName: l.product_name,
        emiAmount: Number(l.emi_amount),
        unpaidCount: unpaid.length,
        overdueAmount: unpaid.length * Number(l.emi_amount),
        earliestDueDate: earliest,
        daysOverdue: differenceInCalendarDays(today, earliest),
      });
    }
  }
  overdueRows.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // -------- Excel export helpers --------------------------------------------
  const downloadOutstandingReport = async () => {
    const XLSX = await import('xlsx');
    const active = loans.filter(l => l.status === 'active');
    if (active.length === 0) return;

    const rows = active.map(l => {
      // Find next pending EMI to surface a due date in the report.
      const first = new Date(l.first_emi_date);
      const loanPays = payments.filter(p => p.loan_id === l.id);
      let nextDueStr = '';
      for (let i = 0; i < l.tenure_months; i++) {
        const due = addMonths(first, i);
        const dueKey = format(due, 'yyyy-MM');
        const matched = loanPays.some(p => format(new Date(p.due_date), 'yyyy-MM') === dueKey);
        if (!matched) { nextDueStr = format(due, 'dd MMM yyyy'); break; }
      }
      const paidAmount = loanPays.reduce((s, p) => s + Number(p.amount_paid), 0);
      return {
        'Loan Code':       l.loan_code,
        'Customer':        l.emi_customers?.full_name || '',
        'Customer Code':   l.emi_customers?.customer_code || '',
        'Product':         l.product_name,
        'Financed (₹)':    Number(l.financed_amount),
        'EMI (₹)':         Number(l.emi_amount),
        'Tenure (months)': Number(l.tenure_months),
        'Paid So Far (₹)': Math.round(paidAmount * 100) / 100,
        'Outstanding (₹)': Number(l.remaining_principal),
        'Next Due':        nextDueStr,
        'First EMI Date':  format(new Date(l.first_emi_date), 'dd MMM yyyy'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding');
    XLSX.writeFile(wb, `${branding.orgShort}_EMI_Outstanding_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const downloadOverdueReport = async () => {
    const XLSX = await import('xlsx');
    if (overdueRows.length === 0) return;

    const rows = overdueRows.map(r => ({
      'Customer':         r.customerName,
      'Customer Code':    r.customerCode,
      'Loan Code':        r.loanCode,
      'Product':          r.productName,
      'EMI (₹)':          r.emiAmount,
      'Unpaid EMIs':      r.unpaidCount,
      'Overdue Amt (₹)':  r.overdueAmount,
      'Earliest Due':     format(r.earliestDueDate, 'dd MMM yyyy'),
      'Days Overdue':     r.daysOverdue,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Overdue');
    XLSX.writeFile(wb, `${branding.orgShort}_EMI_Overdue_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-[#f7b05e]"></i>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <p className="font-bold">Could not load dashboard</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] mx-auto mb-4">
          <i className="fas fa-mobile-alt text-2xl"></i>
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">No EMI activity yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add vendors + customers, then create your first EMI loan. The dashboard will populate automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          onClick={downloadOutstandingReport}
          disabled={activeCount === 0}
          className="gap-2"
          title="Download all active loans with their outstanding balance"
        >
          <i className="fas fa-file-excel"></i> Outstanding Report
        </Button>
        <Button
          variant="outline"
          onClick={downloadOverdueReport}
          disabled={overdueRows.length === 0}
          className="gap-2 border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
          title="Download list of overdue EMIs for follow-up"
        >
          <i className="fas fa-file-excel"></i> Overdue Report
        </Button>
      </div>

      {/* Row 1 — Headline KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="fas fa-rupee-sign"     color="bg-blue-100 text-blue-700"     label="Total Disbursed"     value={formatCurrency(totalDisbursed)} />
        <KpiCard icon="fas fa-hourglass-half" color="bg-orange-100 text-orange-700" label="Outstanding"         value={formatCurrency(outstanding)} />
        <KpiCard icon="fas fa-check-circle"   color="bg-green-100 text-green-700"   label="Collected So Far"    value={formatCurrency(totalCollected)} />
        <KpiCard icon="fas fa-mobile-alt"     color="bg-purple-100 text-purple-700" label="Active Loans"        value={activeCount.toString()} />
      </div>

      {/* Row 2 — This Month's Pulse */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <i className="fas fa-calendar-day text-[#1e5a48]"></i>
          This Month's Pulse — {format(today, 'MMMM yyyy')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PulseStat label="Expected EMI"      value={formatCurrency(expectedEmiThisMonth)}        muted />
          <PulseStat label="Collected"         value={formatCurrency(collectedThisMonth)}          color="text-green-700" />
          <PulseStat
            label="Collection Rate"
            value={`${collectionRate}%`}
            color={collectionRate >= 80 ? 'text-green-700' : collectionRate >= 50 ? 'text-yellow-700' : 'text-red-700'}
            barPct={collectionRate}
          />
        </div>
      </div>

      {/* Row 3 — Overdue Alert (priority) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`p-5 border-b border-gray-100 flex justify-between items-center ${overdueRows.length > 0 ? 'bg-red-50' : 'bg-gray-50/50'}`}>
          <h3 className={`text-lg font-bold flex items-center gap-2 ${overdueRows.length > 0 ? 'text-red-800' : 'text-gray-800'}`}>
            <i className={`fas ${overdueRows.length > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle'}`}></i>
            Overdue EMIs
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${overdueRows.length > 0 ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-700'}`}>
              {overdueRows.length}
            </span>
          </h3>
          {overdueRows.length > 0 && (
            <span className="text-sm font-bold text-red-700">
              {formatCurrency(overdueRows.reduce((s, r) => s + r.overdueAmount, 0))} unpaid
            </span>
          )}
        </div>
        {overdueRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-thumbs-up text-3xl text-green-400 mb-3"></i>
            <p className="font-medium">No overdue EMIs. All active loans are up to date.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Product / Loan</th>
                  <th className="p-4 font-medium text-right">Unpaid EMIs</th>
                  <th className="p-4 font-medium text-right">Overdue Amount</th>
                  <th className="p-4 font-medium text-right">Days Late</th>
                  <th className="p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overdueRows.map(r => (
                  <tr key={r.loanId} className="hover:bg-red-50/40 cursor-pointer" onClick={() => navigate(`/admin/emi/loans/${r.loanId}`)}>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{r.customerName}</p>
                      <p className="text-xs font-mono text-gray-500">{r.customerCode}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-800">{r.productName}</p>
                      <p className="text-xs font-mono text-[#1e5a48]">{r.loanCode}</p>
                    </td>
                    <td className="p-4 text-right">
                      {r.unpaidCount} × {formatCurrency(r.emiAmount)}
                    </td>
                    <td className="p-4 text-right font-bold text-red-700">{formatCurrency(r.overdueAmount)}</td>
                    <td className="p-4 text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        r.daysOverdue > 30 ? 'bg-red-200 text-red-900' :
                        r.daysOverdue > 14 ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {r.daysOverdue} days
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <i className="fas fa-arrow-right text-gray-400"></i>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 4 — Recent Payments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-[#1e5a48]"></i> Recent Payments
          </h3>
        </div>
        {recentPayments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No payments recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Loan</th>
                  <th className="p-3 font-medium text-right">Amount</th>
                  <th className="p-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentPayments.map(p => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => p.loan_id && navigate(`/admin/emi/loans/${p.loan_id}`)}
                  >
                    <td className="p-3 text-xs">{safeFormatDate(p.payment_date)}</td>
                    <td className="p-3">{p.emi_loans?.emi_customers?.full_name || '—'}</td>
                    <td className="p-3">
                      <p className="text-xs">{p.emi_loans?.product_name || '—'}</p>
                      <p className="text-xs font-mono text-gray-500">{p.emi_loans?.loan_code}</p>
                    </td>
                    <td className="p-3 text-right font-bold text-[#1e5a48]">{formatCurrency(p.amount_paid)}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{p.receipt_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 5 — Status breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Portfolio Status</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <StatusPill color="bg-green-100 text-green-800"   label="Active"     count={activeCount} />
          <StatusPill color="bg-gray-100 text-gray-800"     label="Closed"     count={closedCount} />
          <StatusPill color="bg-blue-100 text-blue-800"     label="Foreclosed" count={foreclosedCount} />
          <StatusPill color="bg-red-100 text-red-800"       label="Defaulted"  count={defaultedCount} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KpiCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-xl`}>
        <i className={icon}></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-base lg:text-lg font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function PulseStat({ label, value, color, muted, barPct }: { label: string; value: string; color?: string; muted?: boolean; barPct?: number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color || (muted ? 'text-gray-700' : 'text-gray-800')}`}>{value}</p>
      {barPct !== undefined && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className={`h-1.5 ${barPct >= 80 ? 'bg-green-500' : barPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(100, barPct)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function StatusPill({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className={`px-3 py-1.5 rounded-full font-medium ${color} flex items-center gap-2`}>
      <span>{label}</span>
      <span className="bg-white/60 rounded-full px-2 py-0.5 text-xs font-bold">{count}</span>
    </div>
  );
}
