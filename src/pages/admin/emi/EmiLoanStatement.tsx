import { useState } from 'react';
import { format, addMonths } from 'date-fns';
import { formatCurrency, safeFormatDate } from '../../../lib/utils';
import { Button } from '../../../components/ui/basic';
import { branding } from '../../../config/branding';

// ---------------------------------------------------------------------------
// EmiLoanStatement — printable PDF-style statement for a single EMI loan.
// Uses html2pdf.js (dynamically imported, same pattern as member StatementModal).
// Rendered inside a modal so admin can preview before printing.
// ---------------------------------------------------------------------------

type Loan = {
  loan_code: string;
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
  status: string;
  notes: string | null;
  emi_customers: { customer_code: string; full_name: string; phone: string | null; address: string | null } | null;
  vendors: { name: string; address: string | null } | null;
};

type Payment = {
  id: string;
  amount_paid: number;
  principal_portion: number;
  interest_portion: number;
  penalty_portion: number;
  payment_date: string;
  due_date: string;
  receipt_number: string;
  payment_method: string | null;
};

interface Props {
  loan: Loan;
  payments: Payment[];
  onClose: () => void;
}

export function EmiLoanStatement({ loan, payments, onClose }: Props) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    const element = document.getElementById('emi-printable-statement');
    if (!element) return;
    setPrinting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf().set({
        margin: 0.4,
        filename: `EMI_Statement_${loan.loan_code.replace(/[\/]/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const },
      }).from(element).save();
    } finally {
      setPrinting(false);
    }
  };

  // Build schedule for the printable section.
  const firstDue = new Date(loan.first_emi_date);
  const schedule = Array.from({ length: loan.tenure_months }, (_, i) => {
    const due = addMonths(firstDue, i);
    const match = payments.find(p => format(new Date(p.due_date), 'yyyy-MM') === format(due, 'yyyy-MM'));
    return { idx: i + 1, due, paid: !!match, paidOn: match?.payment_date };
  });

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const totalPrincipalPaid = payments.reduce((s, p) => s + Number(p.principal_portion), 0);
  const totalInterestPaid  = payments.reduce((s, p) => s + Number(p.interest_portion), 0);
  const totalPenaltyPaid   = payments.reduce((s, p) => s + Number(p.penalty_portion), 0);

  const customer = loan.emi_customers;
  const vendor = loan.vendors;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-4 border-b flex justify-between items-center bg-[#0b3b2f] text-white shrink-0">
          <h3 className="font-bold text-lg">EMI Loan Statement — Preview</h3>
          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={printing} className="gap-2 bg-[#f7b05e] hover:bg-[#e09d3e] text-[#0b3b2f]">
              <i className={`fas ${printing ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
              {printing ? 'Generating…' : 'Download PDF'}
            </Button>
            <button onClick={onClose} className="text-white/70 hover:text-white px-2">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 bg-gray-100">
          {/* Printable content — kept simple/B&W-friendly for clean PDF. */}
          <div id="emi-printable-statement" className="bg-white p-8 shadow-md max-w-[8.5in] mx-auto" style={{ fontFamily: 'Arial, sans-serif', color: '#1e2a2e' }}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-[#0b3b2f] pb-4 mb-6">
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0b3b2f', margin: 0 }}>
                  {branding.orgNameNative || branding.orgName}
                </h1>
                <p style={{ fontSize: '11px', margin: '2px 0', color: '#666' }}>{branding.tagline || ''}</p>
                <p style={{ fontSize: '11px', margin: 0, color: '#666' }}>EMI Loan Statement</p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#444' }}>
                <p style={{ margin: 0 }}>Generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
                <p style={{ margin: 0, fontFamily: 'monospace' }}>{loan.loan_code}</p>
              </div>
            </div>

            {/* Customer + Vendor */}
            <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
              <Box title="Customer">
                <Row k="Name" v={customer?.full_name || '—'} />
                <Row k="Customer ID" v={customer?.customer_code || '—'} mono />
                <Row k="Phone" v={customer?.phone || '—'} />
                {customer?.address && <Row k="Address" v={customer.address} />}
              </Box>
              <Box title="Vendor / Product">
                <Row k="Vendor" v={vendor?.name || '—'} />
                {vendor?.address && <Row k="Vendor Address" v={vendor.address} />}
                <Row k="Product" v={loan.product_name} />
                {loan.product_category && <Row k="Category" v={loan.product_category} />}
                {loan.vendor_invoice_number && <Row k="Invoice #" v={loan.vendor_invoice_number} mono />}
              </Box>
            </div>

            {/* Loan terms */}
            <div className="mb-6">
              <SectionTitle>Loan Terms</SectionTitle>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <TermRow label="Product Price"    value={formatCurrency(loan.product_price)} />
                  <TermRow label="Downpayment"      value={formatCurrency(loan.downpayment)} />
                  <TermRow label="Financed Amount"  value={formatCurrency(loan.financed_amount)} bold />
                  <TermRow label="Interest Rate"    value={`${loan.interest_rate}% per annum (flat)`} />
                  <TermRow label="Tenure"           value={`${loan.tenure_months} months`} />
                  <TermRow label="Total Interest"   value={formatCurrency(loan.total_interest)} />
                  <TermRow label="Total Payable"    value={formatCurrency(loan.total_payable)} bold />
                  <TermRow label="Monthly EMI"      value={formatCurrency(loan.emi_amount)} bold highlight />
                  <TermRow label="Disbursed Date"   value={safeFormatDate(loan.disbursed_date, 'dd MMM yyyy')} />
                  <TermRow label="First EMI Date"   value={safeFormatDate(loan.first_emi_date, 'dd MMM yyyy')} />
                  <TermRow label="Status"           value={loan.status.toUpperCase()} />
                </tbody>
              </table>
            </div>

            {/* Payment Summary */}
            <div className="mb-6">
              <SectionTitle>Payment Summary</SectionTitle>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <tbody>
                  <TermRow label="Total EMIs Paid"      value={`${payments.length} of ${loan.tenure_months}`} />
                  <TermRow label="Total Principal Paid" value={formatCurrency(totalPrincipalPaid)} />
                  <TermRow label="Total Interest Paid"  value={formatCurrency(totalInterestPaid)} />
                  <TermRow label="Total Penalty Paid"   value={formatCurrency(totalPenaltyPaid)} />
                  <TermRow label="Grand Total Paid"     value={formatCurrency(totalPaid)} bold />
                  <TermRow label="Outstanding Balance"  value={formatCurrency(loan.remaining_principal)} bold highlight />
                </tbody>
              </table>
            </div>

            {/* Payment History */}
            <div className="mb-6">
              <SectionTitle>Payment History ({payments.length})</SectionTitle>
              {payments.length === 0 ? (
                <p style={{ fontSize: '11px', color: '#777', fontStyle: 'italic' }}>No payments recorded yet.</p>
              ) : (
                <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#0b3b2f', color: '#fff' }}>
                      <th style={cellHeader}>Date</th>
                      <th style={cellHeader}>Receipt</th>
                      <th style={cellHeader}>For Due</th>
                      <th style={{ ...cellHeader, textAlign: 'right' }}>Principal</th>
                      <th style={{ ...cellHeader, textAlign: 'right' }}>Interest</th>
                      <th style={{ ...cellHeader, textAlign: 'right' }}>Penalty</th>
                      <th style={{ ...cellHeader, textAlign: 'right' }}>Total</th>
                      <th style={cellHeader}>Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...payments].sort((a, b) => a.payment_date.localeCompare(b.payment_date)).map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? '#f8f8f8' : '#fff' }}>
                        <td style={cell}>{safeFormatDate(p.payment_date)}</td>
                        <td style={{ ...cell, fontFamily: 'monospace', fontSize: '9px' }}>{p.receipt_number}</td>
                        <td style={cell}>{safeFormatDate(p.due_date)}</td>
                        <td style={{ ...cell, textAlign: 'right' }}>{formatCurrency(p.principal_portion)}</td>
                        <td style={{ ...cell, textAlign: 'right' }}>{formatCurrency(p.interest_portion)}</td>
                        <td style={{ ...cell, textAlign: 'right' }}>{p.penalty_portion > 0 ? formatCurrency(p.penalty_portion) : '—'}</td>
                        <td style={{ ...cell, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(p.amount_paid)}</td>
                        <td style={{ ...cell, textTransform: 'capitalize' }}>{p.payment_method || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* EMI Schedule */}
            <div className="mb-6">
              <SectionTitle>EMI Schedule</SectionTitle>
              <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0b3b2f', color: '#fff' }}>
                    <th style={cellHeader}>#</th>
                    <th style={cellHeader}>Due Date</th>
                    <th style={{ ...cellHeader, textAlign: 'right' }}>EMI Amount</th>
                    <th style={cellHeader}>Status</th>
                    <th style={cellHeader}>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(s => (
                    <tr key={s.idx} style={{ background: s.paid ? '#f0f9f3' : '#fff' }}>
                      <td style={cell}>{s.idx}</td>
                      <td style={cell}>{format(s.due, 'dd MMM yyyy')}</td>
                      <td style={{ ...cell, textAlign: 'right' }}>{formatCurrency(loan.emi_amount)}</td>
                      <td style={cell}>{s.paid ? 'Paid' : 'Pending'}</td>
                      <td style={cell}>{s.paidOn ? safeFormatDate(s.paidOn) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '10px', marginTop: '20px', fontSize: '9px', color: '#777', textAlign: 'center' }}>
              <p style={{ margin: 0 }}>This is a system-generated statement and does not require a signature.</p>
              <p style={{ margin: '4px 0 0 0' }}>{branding.orgName} — Generated {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Sub-components for printable layout -----------------------

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #ccc', borderRadius: '6px', padding: '10px' }}>
      <p style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', color: '#666', fontWeight: 'bold', letterSpacing: '0.5px' }}>{title}</p>
      <div style={{ marginTop: '6px' }}>{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0', fontSize: '11px' }}>
      <span style={{ color: '#666' }}>{k}</span>
      <span style={{ fontWeight: 500, fontFamily: mono ? 'monospace' : 'inherit' }}>{v}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#0b3b2f', borderBottom: '1px solid #0b3b2f', paddingBottom: '4px', marginBottom: '8px' }}>
      {children}
    </h3>
  );
}

function TermRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#444' }}>{label}</td>
      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: bold ? 'bold' : 500, color: highlight ? '#0b3b2f' : '#1e2a2e' }}>{value}</td>
    </tr>
  );
}

const cellHeader: React.CSSProperties = { padding: '5px 6px', textAlign: 'left', fontWeight: 'bold', fontSize: '10px' };
const cell: React.CSSProperties       = { padding: '4px 6px', borderBottom: '1px solid #eee' };
