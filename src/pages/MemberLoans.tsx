import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { safeFormatDate, formatCurrency } from '../lib/utils';
import { translations, useLanguage } from '../lib/lang';

export function MemberLoans() {
  const { memberId } = useAuth();
  const lang = useLanguage();
  const t = translations[lang];
  const [loans, setLoans] = useState<any[]>([]);
  const [repaymentsByLoan, setRepaymentsByLoan] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberId) {
      fetchLoanDetails();
    }
  }, [memberId]);

  const fetchLoanDetails = async () => {
    setLoading(true);
    try {
      // Fetch ALL active loans (a member can have more than one in edge cases).
      const { data: loansData, error: loanErr } = await supabase
        .from('loans')
        .select('*')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .order('disbursed_date', { ascending: false });

      if (loanErr) throw loanErr;
      setLoans(loansData ?? []);

      if (loansData && loansData.length > 0) {
        const loanIds = loansData.map(l => l.id);
        const { data: repays, error: repaysErr } = await supabase
          .from('loan_repayments')
          .select('*')
          .in('loan_id', loanIds)
          .order('payment_date', { ascending: false });

        if (repaysErr) throw repaysErr;
        // Group repayments by loan_id for easy lookup.
        const grouped: Record<string, any[]> = {};
        for (const r of repays ?? []) {
          if (!grouped[r.loan_id]) grouped[r.loan_id] = [];
          grouped[r.loan_id].push(r);
        }
        setRepaymentsByLoan(grouped);
      }
    } catch (err: any) {
      console.error("Error fetching loan details:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-[#f7b05e]"></i>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.loans.title}</h2>

      {loans.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center p-16 text-center">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <i className="fas fa-hand-holding-usd text-5xl text-gray-300"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">{t.loans.noLoansTitle}</h3>
          <p className="text-gray-500 max-w-md">{t.loans.noLoansDesc}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {loans.map((loan, idx) => {
            const repayments = repaymentsByLoan[loan.id] ?? [];
            return (
              <div key={loan.id}>
                {loans.length > 1 && (
                  <p className="text-sm font-semibold text-gray-500 mb-3">Loan {idx + 1} of {loans.length}</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">{t.loans.principalAmt}</p>
                    <p className="text-2xl font-bold text-gray-800">{formatCurrency(loan.principal_amount)}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">{t.loans.remainingBalance}</p>
                    <p className="text-2xl font-bold text-[#1e5a48]">{formatCurrency(loan.remaining_principal)}</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">{t.loans.interestRate}</p>
                    <p className="text-2xl font-bold text-gray-800">{loan.interest_rate}% <span className="text-sm font-normal text-gray-500">{t.loans.flat}</span></p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-medium mb-1">{t.loans.status}</p>
                    <p className="text-lg font-bold text-green-600 bg-green-50 w-max px-3 py-1 rounded-full capitalize">{loan.status}</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <i className="fas fa-list text-[#1e5a48]"></i> {t.loans.repaymentHistory}
                    </h3>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    {repayments.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">{t.loans.noRepayments}</div>
                    ) : (
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#1a5f4a] text-white">
                          <tr>
                            <th className="p-4 font-medium">{t.loans.paymentDate}</th>
                            <th className="p-4 font-medium">{t.loans.receiptNo}</th>
                            <th className="p-4 font-medium text-right">{t.loans.principalPaid}</th>
                            <th className="p-4 font-medium text-right">{t.loans.interestPaid}</th>
                            <th className="p-4 font-medium text-right">{t.loans.totalAmount}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {repayments.map((rp) => (
                            <tr key={rp.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="p-4">{safeFormatDate(rp.payment_date, 'dd MMM, yyyy')}</td>
                              <td className="p-4 font-mono text-xs text-gray-500">{rp.receipt_number}</td>
                              <td className="p-4 text-right font-medium">{formatCurrency(rp.principal_portion)}</td>
                              <td className="p-4 text-right text-gray-600">{formatCurrency(rp.interest_portion)}</td>
                              <td className="p-4 text-right font-bold text-[#1e5a48]">
                                {formatCurrency(Number(rp.principal_portion) + Number(rp.interest_portion))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
