import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { safeFormatDate } from '../../lib/utils';
import { Button } from '../ui/basic';
import html2pdf from 'html2pdf.js';

interface StatementModalProps {
  memberId: string;
  onClose: () => void;
}

export default function StatementModal({ memberId, onClose }: StatementModalProps) {
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState<any>(null);
  const [savings, setSavings] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [repayments, setRepayments] = useState<any[]>([]);

  useEffect(() => {
    const fetchStatementData = async () => {
      setLoading(true);
      try {
        // Fetch member details
        const { data: member } = await supabase
          .from('members')
          .select('*, profiles(full_name, phone)')
          .eq('id', memberId)
          .single();
        
        if (member) setMemberData(member);

        // Fetch savings
        const { data: savingsData } = await supabase
          .from('savings_installments')
          .select('*')
          .eq('member_id', memberId)
          .order('payment_date', { ascending: true });
        if (savingsData) setSavings(savingsData);

        // Fetch loans
        const { data: loansData } = await supabase
          .from('loans')
          .select('*')
          .eq('member_id', memberId)
          .order('disbursed_date', { ascending: true });
        if (loansData) setLoans(loansData);

        // Fetch loan repayments
        if (loansData && loansData.length > 0) {
          const loanIds = loansData.map(l => l.id);
          const { data: repData } = await supabase
            .from('loan_repayments')
            .select('*')
            .in('loan_id', loanIds)
            .order('payment_date', { ascending: true });
          if (repData) setRepayments(repData);
        }

      } catch (error) {
        console.error('Error fetching statement data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (memberId) {
      fetchStatementData();
    }
  }, [memberId]);

  const handlePrint = () => {
    const element = document.getElementById('printable-statement');
    if (!element) return;

    const opt = {
      margin:       0.5,
      filename:     `Account_Statement_${memberData?.member_code || 'Member'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    // Use html2pdf to generate and download the PDF
    html2pdf().set(opt).from(element).save();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">Loading statement...</div>
      </div>
    );
  }

  if (!memberData) return null;

  const totalSavings = savings.reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPenalty = savings.reduce((sum, s) => sum + Number(s.penalty), 0);
  const totalLoanDisbursed = loans.reduce((sum, l) => sum + Number(l.principal_amount), 0);
  const totalLoanRepaid = repayments.reduce((sum, r) => sum + Number(r.principal_portion), 0);
  const activeLoanBalance = totalLoanDisbursed - totalLoanRepaid;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
        
        {/* Header - Hidden on print */}
        <div className="flex justify-between items-center p-6 border-b print:hidden sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-800">Account Statement</h2>
          <div className="flex gap-3">
            <Button onClick={handlePrint} className="bg-[#1e5a48] hover:bg-[#154033] text-white gap-2">
              <i className="fas fa-download"></i> Download PDF
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="p-8 overflow-y-auto print:overflow-visible print:p-0" id="printable-statement">
          
          {/* Statement Header */}
          <div className="flex flex-col items-center text-center mb-8 border-b pb-6" style={{ borderColor: '#e5e7eb' }}>
            <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo" className="w-16 h-16 object-contain mb-3" referrerPolicy="no-referrer" />
            <h1 className="text-3xl font-bold tracking-wider mb-1" style={{ color: '#111827' }}>একতা উন্নয়ন সংস্থা</h1>
            <p className="text-sm font-medium" style={{ color: '#6b7280' }}>Member Account Statement</p>
            <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>Generated on: {format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
          </div>

          {/* Member Details */}
          <div className="grid grid-cols-2 gap-6 mb-8 p-6 rounded-lg print:bg-transparent print:border print:p-4" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6b7280' }}>Member Name</p>
              <p className="font-bold text-lg" style={{ color: '#111827' }}>{memberData.profiles?.full_name}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6b7280' }}>Member ID</p>
              <p className="font-mono font-medium" style={{ color: '#111827' }}>{memberData.member_code}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6b7280' }}>Category & Status</p>
              <p className="font-medium" style={{ color: '#111827' }}>Category {memberData.category} • <span className="capitalize">{memberData.status}</span></p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: '#6b7280' }}>Join Date</p>
              <p className="font-medium" style={{ color: '#111827' }}>{safeFormatDate(memberData.join_date)}</p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border rounded-lg p-4 text-center" style={{ borderColor: '#e5e7eb' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Total Savings</p>
              <p className="text-xl font-bold" style={{ color: '#16a34a' }}>₹{totalSavings.toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-4 text-center" style={{ borderColor: '#e5e7eb' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Active Loan Balance</p>
              <p className="text-xl font-bold" style={{ color: '#ea580c' }}>₹{activeLoanBalance.toLocaleString()}</p>
            </div>
            <div className="border rounded-lg p-4 text-center" style={{ borderColor: '#e5e7eb' }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Total Penalty Paid</p>
              <p className="text-xl font-bold" style={{ color: '#dc2626' }}>₹{totalPenalty.toLocaleString()}</p>
            </div>
          </div>

          {/* Savings Ledger */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 border-b pb-2" style={{ color: '#1f2937', borderColor: '#e5e7eb' }}>Savings History</h3>
            {savings.length === 0 ? (
              <p className="italic text-sm" style={{ color: '#6b7280' }}>No savings transactions found.</p>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                    <th className="p-3 font-semibold" style={{ color: '#4b5563' }}>Date</th>
                    <th className="p-3 font-semibold" style={{ color: '#4b5563' }}>Receipt No.</th>
                    <th className="p-3 font-semibold text-right" style={{ color: '#4b5563' }}>Amount (₹)</th>
                    <th className="p-3 font-semibold text-right" style={{ color: '#4b5563' }}>Penalty (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#e5e7eb' }}>
                  {savings.map((tx) => (
                    <tr key={tx.id}>
                      <td className="p-3" style={{ color: '#111827' }}>{safeFormatDate(tx.payment_date)}</td>
                      <td className="p-3 font-mono text-xs" style={{ color: '#111827' }}>{tx.receipt_number}</td>
                      <td className="p-3 text-right font-medium" style={{ color: '#16a34a' }}>{Number(tx.amount).toLocaleString()}</td>
                      <td className="p-3 text-right" style={{ color: '#ef4444' }}>{Number(tx.penalty) > 0 ? Number(tx.penalty).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Loan Ledger */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-4 border-b pb-2" style={{ color: '#1f2937', borderColor: '#e5e7eb' }}>Loan History</h3>
            {loans.length === 0 ? (
              <p className="italic text-sm" style={{ color: '#6b7280' }}>No loans found.</p>
            ) : (
              <div className="space-y-6">
                {loans.map((loan) => {
                  const loanReps = repayments.filter(r => r.loan_id === loan.id);
                  return (
                    <div key={loan.id} className="border rounded-lg overflow-hidden page-break-inside-avoid" style={{ borderColor: '#e5e7eb' }}>
                      <div className="p-4 border-b flex justify-between items-center" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                        <div>
                          <p className="font-bold" style={{ color: '#1f2937' }}>Loan Disbursed: ₹{Number(loan.principal_amount).toLocaleString()}</p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>Date: {safeFormatDate(loan.disbursed_date)} | Interest: {loan.interest_rate}% | Status: <span className="uppercase">{loan.status}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs mb-1" style={{ color: '#6b7280' }}>Remaining Principal</p>
                          <p className="font-bold" style={{ color: '#ea580c' }}>₹{Number(loan.remaining_principal).toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {loanReps.length > 0 ? (
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b" style={{ borderColor: '#e5e7eb' }}>
                              <th className="p-3 font-semibold bg-white" style={{ color: '#4b5563' }}>Repayment Date</th>
                              <th className="p-3 font-semibold bg-white" style={{ color: '#4b5563' }}>Receipt No.</th>
                              <th className="p-3 font-semibold bg-white text-right" style={{ color: '#4b5563' }}>Principal (₹)</th>
                              <th className="p-3 font-semibold bg-white text-right" style={{ color: '#4b5563' }}>Interest (₹)</th>
                              <th className="p-3 font-semibold bg-white text-right" style={{ color: '#4b5563' }}>Total Paid (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y" style={{ borderColor: '#e5e7eb' }}>
                            {loanReps.map((rep) => (
                              <tr key={rep.id}>
                                <td className="p-3" style={{ color: '#111827' }}>{safeFormatDate(rep.payment_date)}</td>
                                <td className="p-3 font-mono text-xs" style={{ color: '#111827' }}>{rep.receipt_number}</td>
                                <td className="p-3 text-right" style={{ color: '#1f2937' }}>{Number(rep.principal_portion).toLocaleString()}</td>
                                <td className="p-3 text-right" style={{ color: '#1f2937' }}>{Number(rep.interest_portion).toLocaleString()}</td>
                                <td className="p-3 text-right font-medium" style={{ color: '#16a34a' }}>{Number(rep.amount_paid).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-4 text-sm italic" style={{ color: '#6b7280' }}>No repayments made yet.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t text-center text-xs print:block" style={{ borderColor: '#e5e7eb', color: '#9ca3af' }}>
            <p>This is a computer-generated statement and does not require a physical signature.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
