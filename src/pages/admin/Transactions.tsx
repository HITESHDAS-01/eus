import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { formatCurrency } from '../../lib/utils';
import { format, getDate, startOfMonth, setDate } from 'date-fns';
import { useAuth } from '../../lib/AuthContext';

export function Transactions() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter State
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterMember, setFilterMember] = useState('All');

  // Form State
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [penaltySettings, setPenaltySettings] = useState({ percentage: 5, dueDay: 15 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData } = await supabase.from('settings').select('*');
      if (settingsData) {
        const penaltyPct = settingsData.find(s => s.key === 'penalty_percentage')?.value || 5;
        let dueDay = settingsData.find(s => s.key === 'monthly_due_day')?.value;
        
        // Auto-migrate from 10 to 15 if it hasn't been changed manually
        if (dueDay === 10) {
          await supabase.from('settings').update({ value: 15 }).eq('key', 'monthly_due_day');
          dueDay = 15;
        } else if (!dueDay) {
          dueDay = 15;
        }

        setPenaltySettings({ percentage: Number(penaltyPct), dueDay: Number(dueDay) });
      }

      // Fetch members (Cat A and C only for installments)
      const { data: membersData } = await supabase
        .from('members')
        .select('id, member_code, category, profiles(full_name)')
        .in('category', ['A', 'C'])
        .eq('status', 'active');
      if (membersData) setMembers(membersData);

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from('savings_installments')
        .select('*, members(member_code, category, profiles(full_name))')
        .order('created_at', { ascending: false })
        .limit(50);
      if (txData) setTransactions(txData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      const member = members.find(m => m.id === selectedMemberId);
      if (!member) throw new Error('Please select a member');

      const payDate = new Date(paymentDate);
      const dayOfMonth = getDate(payDate);
      
      // Calculate penalty for Cat C if paid after due date
      let penalty = 0;
      if (member.category === 'C' && dayOfMonth > penaltySettings.dueDay) {
        penalty = (Number(amount) * penaltySettings.percentage) / 100;
      }

      const monthYear = startOfMonth(payDate);
      const dueDate = setDate(monthYear, penaltySettings.dueDay);
      const receiptNumber = `RCPT-${format(new Date(), 'yyyyMMddHHmmss')}`;

      const { error: insertError } = await supabase
        .from('savings_installments')
        .insert({
          member_id: selectedMemberId,
          amount: Number(amount),
          penalty: penalty,
          payment_date: paymentDate,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          receipt_number: receiptNumber,
          month_year: format(monthYear, 'yyyy-MM-dd'),
          created_by: user?.id
        });

      if (insertError) throw insertError;

      setIsAddModalOpen(false);
      fetchData(); // Refresh
      setSelectedMemberId(''); setAmount(''); setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (err: any) {
      setError(err.message || 'Failed to add transaction');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const txMonth = format(new Date(tx.payment_date), 'yyyy-MM');
    const matchesMonth = filterMonth === '' || txMonth === filterMonth;
    const matchesMember = filterMember === 'All' || tx.member_id === filterMember;
    return matchesMonth && matchesMember;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Savings Transactions</h2>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
          <i className="fas fa-plus"></i> Record Installment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-full sm:w-48">
          <Label className="text-xs text-gray-500 mb-1 block">Month</Label>
          <Input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)} 
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-gray-500 mb-1 block">Member</Label>
          <select
            value={filterMember}
            onChange={(e) => setFilterMember(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1e5a48] focus:border-transparent bg-white"
          >
            <option value="All">All Members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.member_code} - {m.profiles?.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Receipt No</th>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium text-right">Amount</th>
                <th className="p-4 font-medium text-right">Penalty</th>
                <th className="p-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No transactions found for selected filters.</td></tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="p-4">{format(new Date(tx.payment_date), 'dd MMM yyyy')}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{tx.members?.profiles?.full_name}</div>
                      <div className="text-xs text-[#1e5a48]">{tx.members?.member_code}</div>
                    </td>
                    <td className="p-4 text-right font-medium text-green-600">{formatCurrency(tx.amount)}</td>
                    <td className="p-4 text-right text-red-500">{tx.penalty > 0 ? formatCurrency(tx.penalty) : '-'}</td>
                    <td className="p-4 text-right font-bold">{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">Record Installment</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}
              
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Member (Cat A & C only)</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedMemberId} 
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Member --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.member_code} - {m.profiles?.full_name} (Cat {m.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  <p className="text-xs text-gray-500">Penalty of {penaltySettings.percentage}% will be auto-applied if date is after the {penaltySettings.dueDay}th.</p>
                </div>

                <div className="space-y-2">
                  <Label>Installment Amount (₹)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Recording...' : 'Record Transaction'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
