import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import { format, differenceInMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Input, Label } from '../../components/ui/basic';

export function Reports() {
  const [activeTab, setActiveTab] = useState<'maturity' | 'collection' | 'defaulter' | 'interest'>('maturity');
  const [members, setMembers] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // For maturity
  
  // Date Range Filter
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  useEffect(() => {
    if (activeTab === 'maturity') {
      fetchMaturityData();
    } else if (activeTab === 'collection') {
      fetchCollectionData();
    } else if (activeTab === 'defaulter') {
      fetchDefaulterData();
    } else if (activeTab === 'interest') {
      fetchInterestData();
    }
  }, [activeTab, startDate, endDate]);

  const fetchMaturityData = async () => {
    setLoading(true);
    try {
      const { data: membersData } = await supabase
        .from('members')
        .select(`
          *,
          profiles(full_name, phone),
          savings_installments(amount)
        `)
        .eq('status', 'active');
      
      if (membersData) {
        // Calculate maturity for each
        const processed = membersData.map(m => {
          const totalInstallments = m.savings_installments?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;
          let totalSavings = 0;
          if (m.category === 'A') totalSavings = Number(m.initial_investment) + totalInstallments;
          else if (m.category === 'B') totalSavings = Number(m.initial_investment);
          else if (m.category === 'C') totalSavings = totalInstallments;

          // Calculate ROI based on category and term
          let roi = 0;
          if (m.category === 'B') roi = 36;
          else if (m.category === 'C' && m.chosen_term_months === 24) roi = 16;
          else if (m.category === 'C' && m.chosen_term_months === 36) roi = 27;

          const projectedAmount = totalSavings * (1 + roi / 100);
          
          const joinDate = new Date(m.join_date);
          const maturityDate = new Date(joinDate.setMonth(joinDate.getMonth() + (m.chosen_term_months || 36)));
          const monthsRemaining = differenceInMonths(maturityDate, new Date());

          let maturityStatus = 'Not Matured';
          if (monthsRemaining <= 0) maturityStatus = 'Matured';
          else if (monthsRemaining <= 3) maturityStatus = 'Maturing Soon';

          return {
            ...m,
            totalSavings,
            projectedAmount,
            maturityDate,
            monthsRemaining,
            maturityStatus
          };
        });

        // Sort by maturity date ascending
        processed.sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime());
        setMembers(processed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollectionData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('savings_installments')
        .select('*, members(member_code, profiles(full_name))')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });
      if (data) setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterestData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('loan_repayments')
        .select('*, loans(members(member_code, profiles(full_name)))')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });
      if (data) setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaulterData = async () => {
    setLoading(true);
    try {
      // Get all active A & C members
      const { data: activeMembers } = await supabase
        .from('members')
        .select('id, member_code, category, profiles(full_name, phone)')
        .in('category', ['A', 'C'])
        .eq('status', 'active');

      // Get installments in the date range
      const { data: installments } = await supabase
        .from('savings_installments')
        .select('member_id')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (activeMembers && installments) {
        const paidMemberIds = new Set(installments.map(tx => tx.member_id));
        const defaulters = activeMembers.filter(m => !paidMemberIds.has(m.id));
        setReportData(defaulters);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'matured') return m.maturityStatus === 'Matured';
    if (filter === 'soon') return m.maturityStatus === 'Maturing Soon';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Reports</h2>

      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${activeTab === 'maturity' ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('maturity')}
        >
          Maturity Report
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${activeTab === 'collection' ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('collection')}
        >
          Collection Report
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${activeTab === 'defaulter' ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('defaulter')}
        >
          Defaulter Report
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${activeTab === 'interest' ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('interest')}
        >
          Interest Earned
        </button>
      </div>

      {activeTab !== 'maturity' && (
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'maturity' && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Maturity Overview</h3>
          <select 
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Active Members</option>
            <option value="matured">Matured Only</option>
            <option value="soon">Maturing in ≤ 3 Months</option>
          </select>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              {activeTab === 'maturity' && (
                <tr>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium">Category / Term</th>
                  <th className="p-4 font-medium">Total Savings</th>
                  <th className="p-4 font-medium">Maturity Date</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Projected Payout</th>
                </tr>
              )}
              {activeTab === 'collection' && (
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Receipt No</th>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium text-right">Amount</th>
                  <th className="p-4 font-medium text-right">Penalty</th>
                  <th className="p-4 font-medium text-right">Total</th>
                </tr>
              )}
              {activeTab === 'defaulter' && (
                <tr>
                  <th className="p-4 font-medium">Member ID</th>
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Category</th>
                  <th className="p-4 font-medium">Phone</th>
                </tr>
              )}
              {activeTab === 'interest' && (
                <tr>
                  <th className="p-4 font-medium">Date</th>
                  <th className="p-4 font-medium">Receipt No</th>
                  <th className="p-4 font-medium">Member</th>
                  <th className="p-4 font-medium text-right">Principal Paid</th>
                  <th className="p-4 font-medium text-right">Interest Earned</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading report...</td></tr>
              ) : activeTab === 'maturity' ? (
                filteredMembers.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No members match this filter.</td></tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{m.profiles?.full_name}</div>
                        <div className="text-xs text-[#1e5a48]">{m.member_code}</div>
                      </td>
                      <td className="p-4">
                        Cat {m.category} <span className="text-gray-400">({m.chosen_term_months || '-'}m)</span>
                      </td>
                      <td className="p-4 font-medium">{formatCurrency(m.totalSavings)}</td>
                      <td className="p-4">{format(m.maturityDate, 'dd MMM yyyy')}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          m.maturityStatus === 'Matured' ? 'bg-green-100 text-green-700' :
                          m.maturityStatus === 'Maturing Soon' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {m.maturityStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-[#f7b05e]">{formatCurrency(m.projectedAmount)}</td>
                    </tr>
                  ))
                )
              ) : activeTab === 'collection' ? (
                reportData.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No collections found in this period.</td></tr>
                ) : (
                  reportData.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="p-4">{format(new Date(tx.payment_date), 'dd MMM yyyy')}</td>
                      <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{tx.members?.profiles?.full_name}</div>
                        <div className="text-xs text-gray-500">{tx.members?.member_code}</div>
                      </td>
                      <td className="p-4 text-right">{formatCurrency(tx.amount)}</td>
                      <td className="p-4 text-right text-orange-500">{formatCurrency(tx.penalty)}</td>
                      <td className="p-4 text-right font-bold text-green-600">{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                    </tr>
                  ))
                )
              ) : activeTab === 'defaulter' ? (
                reportData.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No defaulters found in this period.</td></tr>
                ) : (
                  reportData.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="p-4 font-mono text-[#1e5a48]">{m.member_code}</td>
                      <td className="p-4 font-bold text-gray-800">{m.profiles?.full_name}</td>
                      <td className="p-4">Cat {m.category}</td>
                      <td className="p-4 text-gray-600">{m.profiles?.phone}</td>
                    </tr>
                  ))
                )
              ) : activeTab === 'interest' ? (
                reportData.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No interest earned in this period.</td></tr>
                ) : (
                  reportData.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="p-4">{format(new Date(tx.payment_date), 'dd MMM yyyy')}</td>
                      <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{tx.loans?.members?.profiles?.full_name}</div>
                        <div className="text-xs text-gray-500">{tx.loans?.members?.member_code}</div>
                      </td>
                      <td className="p-4 text-right">{formatCurrency(tx.principal_portion)}</td>
                      <td className="p-4 text-right font-bold text-teal-600">+{formatCurrency(tx.interest_portion)}</td>
                    </tr>
                  ))
                )
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
