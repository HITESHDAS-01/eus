import React, { useState, useEffect } from 'react';
import { formatCurrency, calculateMaturityAmount, safeFormatDate } from '../lib/utils';
import { format, differenceInMonths, addMonths } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export function MemberHome() {
  const { memberId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);

  useEffect(() => {
    if (memberId) fetchMemberData();
  }, [memberId]);

  const fetchMemberData = async () => {
    setLoading(true);
    try {
      // Fetch member profile and savings
      const { data: member } = await supabase
        .from('members')
        .select(`
          *,
          profiles(full_name),
          savings_installments(amount)
        `)
        .eq('id', memberId)
        .single();

      // Fetch active loan
      const { data: loan } = await supabase
        .from('loans')
        .select('remaining_principal')
        .eq('member_id', memberId)
        .eq('status', 'active')
        .single();

      // Fetch recent transactions
      const { data: txs } = await supabase
        .from('savings_installments')
        .select('*')
        .eq('member_id', memberId)
        .order('payment_date', { ascending: false })
        .limit(5);

      if (member) {
        const totalInstallments = member.savings_installments?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;
        let totalSavings = 0;
        if (member.category === 'A') totalSavings = Number(member.initial_investment) + totalInstallments;
        else if (member.category === 'B') totalSavings = Number(member.initial_investment);
        else if (member.category === 'C') totalSavings = totalInstallments;

        let roi = 0;
        if (member.category === 'B') roi = 36;
        else if (member.category === 'C' && member.chosen_term_months === 24) roi = 16;
        else if (member.category === 'C' && member.chosen_term_months === 36) roi = 27;

        setMemberData({
          ...member,
          totalSavings,
          activeLoan: loan ? Number(loan.remaining_principal) : 0,
          roi
        });
      }

      if (txs) setRecentTx(txs);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !memberData) return <div className="p-8">Loading your passbook...</div>;

  const joinDate = memberData.join_date ? new Date(memberData.join_date) : new Date();
  const safeJoinDate = isNaN(joinDate.getTime()) ? new Date() : joinDate;
  const maturityDate = addMonths(safeJoinDate, memberData.chosen_term_months || 36);
  const monthsRemaining = differenceInMonths(maturityDate, new Date());
  const isMatured = monthsRemaining <= 0;
  
  const projectedMaturityAmount = calculateMaturityAmount(
    memberData.category,
    Number(memberData.initial_investment),
    memberData.totalSavings,
    memberData.roi
  );

  const loanEligibility = memberData.totalSavings * 0.8;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">My Passbook Overview</h2>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xl">
            <i className="fas fa-piggy-bank"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Savings</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(memberData.totalSavings)}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Loan Eligibility (80%)</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(loanEligibility)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl">
            <i className="fas fa-file-invoice-dollar"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Loan Balance</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(memberData.activeLoan)}</p>
          </div>
        </div>
      </div>

      {/* Maturity Card */}
      <div className={`rounded-3xl p-8 shadow-lg text-white relative overflow-hidden ${isMatured ? 'bg-gradient-to-br from-green-600 to-emerald-800' : 'bg-gradient-to-br from-[#1e5a48] to-[#0b3b2f]'}`}>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-5"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-white opacity-5"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-xl font-bold mb-1">Maturity Summary</h3>
              <p className="text-white/80 text-sm">Category {memberData.category} • {memberData.chosenTermMonths} Months Term</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold border border-white/30">
              <i className="fas fa-chart-line mr-2"></i> {memberData.roi}% ROI
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-white/70 text-sm mb-1">Maturity Date</p>
              <p className="text-2xl font-bold">{safeFormatDate(maturityDate, 'dd MMM, yyyy')}</p>
            </div>
            <div>
              <p className="text-white/70 text-sm mb-1">Projected Maturity Amount</p>
              <p className="text-3xl font-extrabold text-[#f7b05e]">{formatCurrency(projectedMaturityAmount)}</p>
            </div>
          </div>

          {isMatured ? (
            <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/40 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-400 rounded-full flex items-center justify-center text-green-900 text-xl flex-shrink-0">
                <i className="fas fa-check"></i>
              </div>
              <p className="font-medium">🎉 Your savings have matured! Contact admin to withdraw with profit.</p>
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl p-5">
              <div className="flex justify-between text-sm mb-2">
                <span>Time Remaining</span>
                <span className="font-bold">{monthsRemaining} months</span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2.5 mb-4 overflow-hidden">
                <div 
                  className="bg-[#f7b05e] h-2.5 rounded-full" 
                  style={{ width: `${Math.max(0, Math.min(100, ((memberData.chosenTermMonths - monthsRemaining) / memberData.chosenTermMonths) * 100))}%` }}
                ></div>
              </div>
              <p className="text-xs text-white/70 flex items-center gap-1.5">
                <i className="fas fa-exclamation-triangle text-[#f7b05e]"></i> 
                Early withdrawal forfeits profit. Only principal will be returned.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions Preview */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
          <button className="text-[#1e5a48] text-sm font-medium hover:underline">View All</button>
        </div>
        <div className="p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm">
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Receipt No.</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">No recent transactions.</td></tr>
              ) : (
                recentTx.map((tx, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="p-4 text-sm">{safeFormatDate(tx.payment_date, 'dd MMM, yyyy')}</td>
                    <td className="p-4 text-sm font-mono text-gray-500">{tx.receipt_number}</td>
                    <td className="p-4 text-sm"><span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-medium">Installment</span></td>
                    <td className="p-4 text-sm font-bold text-right">{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
