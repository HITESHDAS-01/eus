import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';

export function AdminHome() {
  const [stats, setStats] = useState({
    totalTreasury: 0,
    activeLoans: 0,
    totalMembers: 0,
    currentMonthCollection: 0,
    totalPenaltyCollected: 0,
    totalInterestEarned: 0,
    maturedMembersCount: 0,
  });
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Total Members
      const { count: membersCount } = await supabase.from('members').select('*', { count: 'exact', head: true });
      
      // 2. Active Loans Total
      const { data: loans } = await supabase.from('loans').select('remaining_principal').eq('status', 'active');
      const activeLoansTotal = loans?.reduce((sum, l) => sum + Number(l.remaining_principal), 0) || 0;

      // 3. Total Treasury (All installments + initial investments + interest + penalty - active loans)
      const { data: members } = await supabase.from('members').select('initial_investment');
      const totalInitial = members?.reduce((sum, m) => sum + Number(m.initial_investment), 0) || 0;
      
      const { data: installments } = await supabase.from('savings_installments').select('amount, penalty');
      const totalInstallments = installments?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
      const totalPenalty = installments?.reduce((sum, i) => sum + Number(i.penalty), 0) || 0;

      const { data: repayments } = await supabase.from('loan_repayments').select('interest_portion');
      const totalInterest = repayments?.reduce((sum, r) => sum + Number(r.interest_portion), 0) || 0;

      const totalTreasury = totalInitial + totalInstallments + totalPenalty + totalInterest - activeLoansTotal;

      // 4. Current Month Collection
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const { data: currentMonthTx } = await supabase
        .from('savings_installments')
        .select('amount, penalty')
        .gte('payment_date', startOfMonth.toISOString());
      const currentMonthTotal = currentMonthTx?.reduce((sum, tx) => sum + Number(tx.amount) + Number(tx.penalty), 0) || 0;

      setStats({
        totalTreasury,
        activeLoans: activeLoansTotal,
        totalMembers: membersCount || 0,
        currentMonthCollection: currentMonthTotal,
        totalPenaltyCollected: totalPenalty,
        totalInterestEarned: totalInterest,
        maturedMembersCount: 0, // Will be calculated in Reports
      });

      // 5. Recent Transactions
      const { data: recent } = await supabase
        .from('savings_installments')
        .select('amount, penalty, created_at, members(member_code)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (recent) setRecentTx(recent);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading dashboard...</div>;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-[#1e5a48]">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Treasury</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.totalTreasury)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Active Loans</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.activeLoans)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Members</p>
          <p className="text-2xl font-bold text-gray-800">{stats.totalMembers}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Current Month Collection</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.currentMonthCollection)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-orange-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Penalty Collected</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.totalPenaltyCollected)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-teal-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Total Interest Earned</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.totalInterestEarned)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-500 font-medium mb-1">Matured Members</p>
          <p className="text-2xl font-bold text-gray-800">{stats.maturedMembersCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-800">Recent Transactions</h3>
            <button className="text-sm text-[#1e5a48] font-medium hover:underline">View All</button>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm">
              <tbody>
                {recentTx.length === 0 ? (
                  <tr><td className="p-4 text-gray-500 text-center">No recent transactions.</td></tr>
                ) : (
                  recentTx.map((tx, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-4">{tx.members?.member_code}</td>
                      <td className="p-4 text-gray-500">{format(new Date(tx.created_at), 'dd MMM yyyy')}</td>
                      <td className="p-4 font-bold text-right text-green-600">+{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maturity Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50">
            <h3 className="font-bold text-red-800 flex items-center gap-2">
              <i className="fas fa-bell"></i> Maturity Alerts
            </h3>
            <button className="text-sm text-red-700 font-medium hover:underline">View Report</button>
          </div>
          <div className="p-4 space-y-3">
            <div className="bg-white border border-red-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <p className="font-bold text-gray-800 text-sm">EUS/012024/C/012</p>
                <p className="text-xs text-gray-500">Matured on 10 Mar 2024</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#f7b05e]">{formatCurrency(3048)}</p>
                <button className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded mt-1 hover:bg-green-200 transition-colors">Process Payout</button>
              </div>
            </div>
            <div className="bg-white border border-orange-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <p className="font-bold text-gray-800 text-sm">EUS/022024/B/003</p>
                <p className="text-xs text-gray-500">Maturing in 15 days</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#f7b05e]">{formatCurrency(13600)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
