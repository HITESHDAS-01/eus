import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import { format, differenceInMonths } from 'date-fns';

export function Reports() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchMaturityData();
  }, []);

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

  const filteredMembers = members.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'matured') return m.maturityStatus === 'Matured';
    if (filter === 'soon') return m.maturityStatus === 'Maturing Soon';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Maturity Report</h2>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Category / Term</th>
                <th className="p-4 font-medium">Total Savings</th>
                <th className="p-4 font-medium">Maturity Date</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Projected Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading report...</td></tr>
              ) : filteredMembers.length === 0 ? (
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
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
