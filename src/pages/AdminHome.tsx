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
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-medium text-gray-800 tracking-tight">Dashboard Overview</h2>
        <button className="bg-[#1e5a48] hover:bg-[#154234] text-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 text-sm font-medium active:scale-[0.98]">
          <i className="fas fa-download"></i> Export Report
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-vault text-6xl text-[#1e5a48]"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Total Treasury</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{formatCurrency(stats.totalTreasury)}</p>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-hand-holding-usd text-6xl text-blue-500"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Active Loans</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{formatCurrency(stats.activeLoans)}</p>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-users text-6xl text-purple-500"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Total Members</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{stats.totalMembers}</p>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-calendar-check text-6xl text-green-500"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Current Month Collection</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{formatCurrency(stats.currentMonthCollection)}</p>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-exclamation-circle text-6xl text-orange-500"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Total Penalty Collected</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{formatCurrency(stats.totalPenaltyCollected)}</p>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-chart-line text-6xl text-teal-500"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Total Interest Earned</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{formatCurrency(stats.totalInterestEarned)}</p>
        </div>
        
        <div className="bg-white rounded-3xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(6,81,237,0.15)] transition-shadow duration-300 border border-gray-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i className="fas fa-award text-6xl text-red-500"></i>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-2 relative z-10">Matured Members</p>
          <p className="text-3xl font-bold text-gray-800 tracking-tight relative z-10">{stats.maturedMembersCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mt-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-50 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-800">Recent Transactions</h3>
            <button className="text-sm text-[#1e5a48] font-medium hover:bg-[#1e5a48]/10 px-3 py-1.5 rounded-full transition-colors">View All</button>
          </div>
          <div className="p-0 flex-1">
            <table className="w-full text-left text-sm">
              <tbody>
                {recentTx.length === 0 ? (
                  <tr><td className="p-6 text-gray-500 text-center">No recent transactions.</td></tr>
                ) : (
                  recentTx.map((tx, idx) => (
                    <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 pl-6 font-medium text-gray-700">{tx.members?.member_code}</td>
                      <td className="p-4 text-gray-500">{format(new Date(tx.created_at), 'dd MMM yyyy')}</td>
                      <td className="p-4 pr-6 font-bold text-right text-green-600">+{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maturity Alerts */}
        <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-50 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-medium text-red-800 flex items-center gap-2">
              <i className="fas fa-bell text-red-500"></i> Maturity Alerts
            </h3>
            <button className="text-sm text-red-700 font-medium hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors">View Report</button>
          </div>
          <div className="p-6 space-y-4 flex-1 bg-red-50/30">
            <div className="bg-white border border-red-100 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
              <div>
                <p className="font-bold text-gray-800">EUS/012024/C/012</p>
                <p className="text-sm text-red-500 font-medium mt-0.5">Matured on 10 Mar 2024</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-xl text-gray-800">{formatCurrency(3048)}</p>
                <button className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-full mt-2 hover:bg-green-200 transition-colors font-medium active:scale-95">Process Payout</button>
              </div>
            </div>
            <div className="bg-white border border-orange-100 p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
              <div>
                <p className="font-bold text-gray-800">EUS/022024/B/003</p>
                <p className="text-sm text-orange-500 font-medium mt-0.5">Maturing in 15 days</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-xl text-gray-800">{formatCurrency(13600)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
