import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, addMonths } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { Button, Input, Label } from '../../../components/ui/basic';
import { formatCurrency, safeFormatDate } from '../../../lib/utils';
import { useAuth } from '../../../lib/AuthContext';

// ---------------------------------------------------------------------------
// EMI Loan Profile — single-loan detail page with payment + foreclosure flow.
// Route: /admin/emi/loans/:id
//
// Sections:
//   - Header (product, loan code, status)
//   - KPI strip (EMI, outstanding, paid so far, next due)
//   - Loan terms card (price, downpayment, rate, tenure, financed, totals)
//   - Customer + vendor cards
//   - EMI Schedule (synthetic — derived from first_emi_date + tenure)
//   - Payment history (real rows from emi_payments)
//   - Actions: Record Payment, Foreclose, Delete
// ---------------------------------------------------------------------------

type Loan = {
  id: string;
  loan_code: string;
  customer_id: string;
  vendor_id: string;
  product_name: string;
  product_category: string | null;
  product_price: number;
  downpayment: number;
  financed_amount: number;
  interest_rate: number;
  tenure_months: number;
  emi_amount: number;
  total_payable: number;
  total_interest: number;
  vendor_paid_amount: number;
  vendor_paid_date: string;
  vendor_invoice_number: string | null;
  disbursed_date: string;
  first_emi_date: string;
  remaining_principal: number;
  status: 'active' | 'closed' | 'defaulted' | 'foreclosed';
  notes: string | null;
  created_at: string;
  emi_customers: { id: string; customer_code: string; full_name: string; phone: string | null; photo_url: string | null } | null;
  vendors: { id: string; name: string; address: string | null } | null;
};

type Payment = {
  id: string;
  loan_id: string;
  amount_paid: number;
  principal_portion: number;
  interest_portion: number;
  penalty_portion: number;
  payment_date: string;
  due_date: string;
  month_year: string;
  receipt_number: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
};

export function EmiLoanProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [penaltySettings, setPenaltySettings] = useState({ percentage: 5, gracePeriod: 3 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment modal
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payPrincipal, setPayPrincipal] = useState('');
  const [payInterest, setPayInterest] = useState('');
  const [payPenalty, setPayPenalty] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [payDueDate, setPayDueDate] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');

  // Foreclose modal
  const [isForeclosureOpen, setIsForeclosureOpen] = useState(false);
  const [foreclosing, setForeclosing] = useState(false);
  const [foreclosureError, setForeclosureError] = useState('');

  // Delete modal
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => { if (id) fetchData(id); }, [id]);

  const fetchData = async (loanId: string) => {
    setLoading(true);
    setError('');
    try {
      const [loanRes, payRes, settingsRes] = await Promise.all([
        supabase
          .from('emi_loans')
          .select('*, emi_customers(id, customer_code, full_name, phone, photo_url), vendors(id, name, address)')
          .eq('id', loanId)
          .single(),
        supabase
          .from('emi_payments')
          .select('*')
          .eq('loan_id', loanId)
          .order('payment_date', { ascending: false }),
        supabase.from('settings').select('*').in('key', ['penalty_percentage', 'grace_period_days']),
      ]);

      if (loanRes.error) throw loanRes.error;
      setLoan(loanRes.data);
      setPayments(payRes.data || []);

      if (settingsRes.data) {
        const pct = Number(settingsRes.data.find(s => s.key === 'penalty_percentage')?.value ?? 5);
        const gp  = Number(settingsRes.data.find(s => s.key === 'grace_period_days')?.value ?? 3);
        setPenaltySettings({ percentage: isNaN(pct) ? 5 : pct, gracePeriod: isNaN(gp) ? 3 : gp });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load loan');
    } finally {
      setLoading(false);
    }
  };

  // ------ EMI Schedule derived from first_emi_date + tenure -----------------
  const schedule = (() => {
    if (!loan) return [];
    const out: { idx: number; dueDate: Date; paid: boolean; paidOn?: string }[] = [];
    const firstDue = new Date(loan.first_emi_date);
    for (let i = 0; i < loan.tenure_months; i++) {
      const due = addMonths(firstDue, i);
      // EMI is "paid" if there's any payment whose month_year matches (or due_date)
      const match = payments.find(p => {
        const pdMonth = format(new Date(p.due_date), 'yyyy-MM');
        return pdMonth === format(due, 'yyyy-MM');
      });
      out.push({ idx: i + 1, dueDate: due, paid: !!match, paidOn: match?.payment_date });
    }
    return out;
  })();

  const nextDue = schedule.find(s => !s.paid);
  const paidCount = schedule.filter(s => s.paid).length;
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0);

  // ------ Payment modal helpers ---------------------------------------------
  const openPayment = () => {
    if (!loan) return;
    setPayError('');
    const principalPerEmi = round2(loan.financed_amount / loan.tenure_months);
    const interestPerEmi  = round2(loan.total_interest  / loan.tenure_months);
    // Pre-fill with the next-due EMI's portions, capped to remaining principal.
    const principal = Math.min(principalPerEmi, loan.remaining_principal);
    setPayPrincipal(String(principal));
    setPayInterest(String(interestPerEmi));
    const defaultDue = nextDue ? format(nextDue.dueDate, 'yyyy-MM-dd') : format(new Date(loan.first_emi_date), 'yyyy-MM-dd');
    setPayDueDate(defaultDue);
    const today = format(new Date(), 'yyyy-MM-dd');
    setPayDate(today);
    // Auto-penalty preview
    const auto = computeAutoPenalty(today, defaultDue, loan.emi_amount);
    setPayPenalty(String(auto));
    setPayAmount(String(round2(principal + interestPerEmi + auto)));
    setPayMethod('cash');
    setPayNotes('');
    setIsPayOpen(true);
  };

  const computeAutoPenalty = (paymentDateStr: string, dueDateStr: string, emi: number): number => {
    if (!paymentDateStr || !dueDateStr) return 0;
    const payD = new Date(paymentDateStr);
    const dueD = new Date(dueDateStr);
    if (isNaN(payD.getTime()) || isNaN(dueD.getTime())) return 0;
    const graceEnd = new Date(dueD);
    graceEnd.setDate(graceEnd.getDate() + penaltySettings.gracePeriod);
    if (payD > graceEnd) {
      return round2((emi * penaltySettings.percentage) / 100);
    }
    return 0;
  };

  // Recompute amount when portions change.
  const updateAmountFromPortions = (p: string, i: string, pen: string) => {
    const sum = (Number(p) || 0) + (Number(i) || 0) + (Number(pen) || 0);
    setPayAmount(String(round2(sum)));
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    setPayLoading(true);
    setPayError('');
    try {
      const principal = Number(payPrincipal) || 0;
      const interest  = Number(payInterest)  || 0;
      const penalty   = Number(payPenalty)   || 0;
      const amount    = Number(payAmount)    || 0;

      if (amount <= 0) throw new Error('Amount paid must be greater than 0');
      if (principal < 0 || interest < 0 || penalty < 0) throw new Error('Portions cannot be negative');
      if (principal > loan.remaining_principal) {
        throw new Error(`Principal portion (${formatCurrency(principal)}) exceeds outstanding balance (${formatCurrency(loan.remaining_principal)})`);
      }
      if (Math.abs(amount - (principal + interest + penalty)) > 0.5) {
        throw new Error('Amount paid must equal principal + interest + penalty');
      }
      if (!payDate) throw new Error('Payment date is required');
      if (!payDueDate) throw new Error('Due date is required');

      const monthYear = format(new Date(new Date(payDueDate).getFullYear(), new Date(payDueDate).getMonth(), 1), 'yyyy-MM-dd');
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const receiptNumber = `EMI-${format(new Date(), 'yyyyMMddHHmmss')}-${suffix}`;

      const { error: rpcErr } = await supabase.rpc('record_emi_payment', {
        p_loan_id: loan.id,
        p_amount_paid: amount,
        p_principal_portion: principal,
        p_interest_portion: interest,
        p_penalty_portion: penalty,
        p_payment_date: payDate,
        p_due_date: payDueDate,
        p_month_year: monthYear,
        p_receipt_number: receiptNumber,
        p_payment_method: payMethod || null,
        p_notes: payNotes.trim() || null,
        p_created_by: (user?.id && user.id.length > 20) ? user.id : null,
      });
      if (rpcErr) throw rpcErr;

      setIsPayOpen(false);
      setSuccessMessage(`Payment of ${formatCurrency(amount)} recorded. Receipt: ${receiptNumber}`);
      fetchData(loan.id);
    } catch (err: any) {
      setPayError(err.message || 'Failed to record payment');
    } finally {
      setPayLoading(false);
    }
  };

  // ------ Foreclose ----------------------------------------------------------
  const handleForeclose = async () => {
    if (!loan) return;
    setForeclosing(true);
    setForeclosureError('');
    try {
      const principal = loan.remaining_principal;
      if (principal <= 0) throw new Error('Loan is already closed');

      const today = format(new Date(), 'yyyy-MM-dd');
      const monthYear = format(new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 1), 'yyyy-MM-dd');
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const receiptNumber = `EMI-FC-${format(new Date(), 'yyyyMMddHHmmss')}-${suffix}`;

      // Record a closing payment for the full remaining principal (no interest, no penalty).
      // RPC will set status to 'closed' automatically — we then patch it to 'foreclosed'.
      const { error: rpcErr } = await supabase.rpc('record_emi_payment', {
        p_loan_id: loan.id,
        p_amount_paid: principal,
        p_principal_portion: principal,
        p_interest_portion: 0,
        p_penalty_portion: 0,
        p_payment_date: today,
        p_due_date: today,
        p_month_year: monthYear,
        p_receipt_number: receiptNumber,
        p_payment_method: 'foreclosure',
        p_notes: 'Loan foreclosed',
        p_created_by: (user?.id && user.id.length > 20) ? user.id : null,
      });
      if (rpcErr) throw rpcErr;

      // Update status from 'closed' to 'foreclosed' for proper categorisation.
      const { error: updErr } = await supabase
        .from('emi_loans')
        .update({ status: 'foreclosed' })
        .eq('id', loan.id);
      if (updErr) throw updErr;

      setIsForeclosureOpen(false);
      setSuccessMessage(`Loan foreclosed. Customer paid ${formatCurrency(principal)} to close the balance.`);
      fetchData(loan.id);
    } catch (err: any) {
      setForeclosureError(err.message || 'Failed to foreclose loan');
    } finally {
      setForeclosing(false);
    }
  };

  // ------ Delete --------------------------------------------------------------
  const handleDelete = async () => {
    if (!loan) return;
    setDeleting(true);
    setDeleteError('');
    try {
      // emi_payments rows cascade via FK
      const { error: err } = await supabase.from('emi_loans').delete().eq('id', loan.id);
      if (err) throw err;
      navigate('/admin/emi');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete loan');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-[#f7b05e]"></i>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate('/admin/emi')} className="gap-2">
          <i className="fas fa-arrow-left"></i> Back to EMI Loans
        </Button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
          <p className="font-bold mb-1">Could not load loan</p>
          <p className="text-sm">{error || 'Loan not found.'}</p>
        </div>
      </div>
    );
  }

  const customer = loan.emi_customers;
  const vendor = loan.vendors;
  const isActive = loan.status === 'active';

  return (
    <div className="p-6 space-y-6">
      <Button variant="outline" onClick={() => navigate('/admin/emi')} className="gap-2">
        <i className="fas fa-arrow-left"></i> Back to EMI Loans
      </Button>

      {successMessage && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200 flex justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="opacity-70 hover:opacity-100">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] text-2xl shrink-0">
            <i className="fas fa-mobile-alt"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-2xl font-bold text-gray-800">{loan.product_name}</h1>
              <StatusBadge status={loan.status} />
            </div>
            <p className="font-mono text-sm text-[#1e5a48] mt-1">{loan.loan_code}</p>
            {loan.product_category && (
              <p className="text-xs text-gray-500 mt-1">{loan.product_category}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {isActive && (
              <>
                <Button onClick={openPayment} className="gap-2">
                  <i className="fas fa-money-bill-wave"></i> Record Payment
                </Button>
                <Button variant="outline" onClick={() => { setForeclosureError(''); setIsForeclosureOpen(true); }} className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50">
                  <i className="fas fa-flag-checkered"></i> Foreclose
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => { setDeleteError(''); setIsDeleteOpen(true); }} className="gap-2 border-red-300 text-red-600 hover:bg-red-50">
              <i className="fas fa-trash"></i> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon="fas fa-calendar-alt"     color="bg-blue-100 text-blue-700"     label="Monthly EMI"     value={formatCurrency(loan.emi_amount)} />
        <KpiCard icon="fas fa-hourglass-half"  color="bg-orange-100 text-orange-700" label="Outstanding"     value={formatCurrency(loan.remaining_principal)} />
        <KpiCard icon="fas fa-check-circle"    color="bg-green-100 text-green-700"   label="Paid So Far"     value={formatCurrency(totalPaid)} />
        <KpiCard icon="fas fa-clock"           color="bg-gray-100 text-gray-700"     label={nextDue ? 'Next EMI Due' : 'All EMIs Done'} value={nextDue ? safeFormatDate(nextDue.dueDate, 'dd MMM yyyy') : '—'} />
      </div>

      {/* Loan terms */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-file-invoice-dollar text-[#1e5a48]"></i> Loan Terms
          </h3>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="Product Price"   value={formatCurrency(loan.product_price)} />
          <Stat label="Downpayment"     value={formatCurrency(loan.downpayment)} />
          <Stat label="Financed Amount" value={formatCurrency(loan.financed_amount)} highlight />
          <Stat label="Interest Rate"   value={`${loan.interest_rate}% p.a. flat`} />
          <Stat label="Tenure"          value={`${loan.tenure_months} months`} />
          <Stat label="Total Interest"  value={formatCurrency(loan.total_interest)} />
          <Stat label="Total Payable"   value={formatCurrency(loan.total_payable)} />
          <Stat label="Disbursed Date"  value={safeFormatDate(loan.disbursed_date, 'dd MMM yyyy')} />
        </div>
      </div>

      {/* Customer + Vendor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-user text-[#1e5a48]"></i> Customer
            </h3>
          </div>
          <div className="p-5">
            {customer ? (
              <Link to={`/admin/emi/customers/${customer.id}`} className="flex items-center gap-3 group">
                <div className="w-12 h-12 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10">
                  {customer.photo_url ? (
                    <img src={customer.photo_url} alt={customer.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <i className="fas fa-user"></i>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-800 group-hover:text-[#1e5a48]">{customer.full_name}</p>
                  <p className="text-xs font-mono text-[#1e5a48]">{customer.customer_code}</p>
                  {customer.phone && <p className="text-xs text-gray-500 mt-1">{customer.phone}</p>}
                </div>
                <i className="fas fa-arrow-right text-gray-400 group-hover:text-[#1e5a48]"></i>
              </Link>
            ) : (
              <p className="text-gray-400 italic">Customer record unavailable</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-store text-[#1e5a48]"></i> Vendor
            </h3>
          </div>
          <div className="p-5 space-y-2 text-sm">
            <p className="font-bold text-gray-800">{vendor?.name || '—'}</p>
            {vendor?.address && <p className="text-gray-600">{vendor.address}</p>}
            <div className="pt-2 border-t border-gray-100 text-xs text-gray-500 space-y-1">
              <p>Vendor paid: <strong className="text-gray-800">{formatCurrency(loan.vendor_paid_amount)}</strong> on <strong className="text-gray-800">{safeFormatDate(loan.vendor_paid_date, 'dd MMM yyyy')}</strong></p>
              {loan.vendor_invoice_number && (
                <p>Invoice: <span className="font-mono">{loan.vendor_invoice_number}</span></p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EMI Schedule */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-calendar text-[#1e5a48]"></i> EMI Schedule
          </h3>
          <span className="text-sm text-gray-600">{paidCount} of {loan.tenure_months} paid</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Due Date</th>
                <th className="p-3 font-medium text-right">EMI Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Paid On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedule.map(row => (
                <tr key={row.idx} className={row.paid ? 'bg-green-50/30' : ''}>
                  <td className="p-3 text-gray-500">{row.idx}</td>
                  <td className="p-3 text-xs">{format(row.dueDate, 'dd MMM yyyy')}</td>
                  <td className="p-3 text-right">{formatCurrency(loan.emi_amount)}</td>
                  <td className="p-3">
                    {row.paid ? (
                      <span className="text-green-700 text-xs font-bold"><i className="fas fa-check-circle"></i> Paid</span>
                    ) : (
                      <span className="text-gray-500 text-xs">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-gray-600">{row.paidOn ? safeFormatDate(row.paidOn) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-[#1e5a48]"></i> Payment History ({payments.length})
          </h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No payments recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 font-medium">Payment Date</th>
                  <th className="p-3 font-medium">Receipt</th>
                  <th className="p-3 font-medium">For (Due)</th>
                  <th className="p-3 font-medium text-right">Principal</th>
                  <th className="p-3 font-medium text-right">Interest</th>
                  <th className="p-3 font-medium text-right">Penalty</th>
                  <th className="p-3 font-medium text-right">Total</th>
                  <th className="p-3 font-medium">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 text-xs">{safeFormatDate(p.payment_date)}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{p.receipt_number}</td>
                    <td className="p-3 text-xs">{safeFormatDate(p.due_date)}</td>
                    <td className="p-3 text-right">{formatCurrency(p.principal_portion)}</td>
                    <td className="p-3 text-right text-gray-600">{formatCurrency(p.interest_portion)}</td>
                    <td className="p-3 text-right text-red-500">{p.penalty_portion > 0 ? formatCurrency(p.penalty_portion) : '—'}</td>
                    <td className="p-3 text-right font-bold text-[#1e5a48]">{formatCurrency(p.amount_paid)}</td>
                    <td className="p-3 text-xs capitalize">{p.payment_method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============ Payment Modal ============ */}
      {isPayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">Record EMI Payment</h3>
              <button onClick={() => setIsPayOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {payError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{payError}</div>}

              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Payment Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={payDate} onChange={(e) => {
                      const v = e.target.value;
                      setPayDate(v);
                      // Recompute auto-penalty
                      if (loan) {
                        const auto = computeAutoPenalty(v, payDueDate, loan.emi_amount);
                        setPayPenalty(String(auto));
                        updateAmountFromPortions(payPrincipal, payInterest, String(auto));
                      }
                    }} required />
                  </div>
                  <div className="space-y-2">
                    <Label>For Due Date <span className="text-red-500">*</span></Label>
                    <Input type="date" value={payDueDate} onChange={(e) => {
                      const v = e.target.value;
                      setPayDueDate(v);
                      if (loan) {
                        const auto = computeAutoPenalty(payDate, v, loan.emi_amount);
                        setPayPenalty(String(auto));
                        updateAmountFromPortions(payPrincipal, payInterest, String(auto));
                      }
                    }} required />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Principal (₹)</Label>
                    <Input type="number" value={payPrincipal} onChange={(e) => {
                      setPayPrincipal(e.target.value);
                      updateAmountFromPortions(e.target.value, payInterest, payPenalty);
                    }} min="0" step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest (₹)</Label>
                    <Input type="number" value={payInterest} onChange={(e) => {
                      setPayInterest(e.target.value);
                      updateAmountFromPortions(payPrincipal, e.target.value, payPenalty);
                    }} min="0" step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label>Penalty (₹)</Label>
                    <Input type="number" value={payPenalty} onChange={(e) => {
                      setPayPenalty(e.target.value);
                      updateAmountFromPortions(payPrincipal, payInterest, e.target.value);
                    }} min="0" step="0.01" />
                  </div>
                </div>

                <div className="bg-[#1e5a48]/5 border border-[#1e5a48]/20 rounded-lg p-3 text-sm">
                  <p className="text-gray-600">Total amount to receive</p>
                  <p className="text-2xl font-bold text-[#1e5a48]">{formatCurrency(Number(payAmount) || 0)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <i className="fas fa-info-circle"></i> Penalty auto-fills based on {penaltySettings.percentage}% rate + {penaltySettings.gracePeriod} day grace. Editable.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Total Amount Paid (₹)</Label>
                  <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required min="0.01" step="0.01" />
                  <p className="text-xs text-gray-500">Must equal principal + interest + penalty.</p>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={payLoading}>
                    {payLoading ? 'Recording…' : 'Record Payment'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============ Foreclose Modal ============ */}
      {isForeclosureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-blue-50 text-blue-800 flex items-center gap-3">
              <i className="fas fa-flag-checkered text-xl"></i>
              <h3 className="font-bold text-lg">Foreclose Loan?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Close this loan by collecting the full remaining principal in one payment.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="font-bold">{formatCurrency(loan.remaining_principal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Interest charged</span><span>₹0 (foreclosure)</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2"><span className="font-bold text-gray-800">Customer pays</span><span className="font-bold text-blue-700">{formatCurrency(loan.remaining_principal)}</span></div>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                <i className="fas fa-info-circle"></i> The loan status will change to <strong>Foreclosed</strong>. A payment receipt is generated automatically.
              </p>
              {foreclosureError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{foreclosureError}</div>
              )}
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setIsForeclosureOpen(false)} disabled={foreclosing}>Cancel</Button>
                <Button onClick={handleForeclose} disabled={foreclosing} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {foreclosing ? 'Foreclosing…' : 'Confirm Foreclosure'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ Delete Modal ============ */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Delete this loan?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Permanently delete <strong>{loan.product_name}</strong> ({loan.loan_code})? All {payments.length} payment record{payments.length === 1 ? '' : 's'} will be removed too. This cannot be undone.
              </p>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>
              )}
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={deleting}>Cancel</Button>
                <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? 'Deleting…' : 'Delete Loan'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:     'bg-green-100 text-green-700',
    closed:     'bg-gray-100 text-gray-700',
    defaulted:  'bg-red-100 text-red-700',
    foreclosed: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function KpiCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
        <i className={icon}></i>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-base font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold ${highlight ? 'text-[#1e5a48]' : 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
