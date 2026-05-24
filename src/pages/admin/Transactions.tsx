import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { format, getDate, startOfMonth, setDate } from 'date-fns';
import { useAuth } from '../../lib/AuthContext';

export function Transactions() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Filter State
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [filterMember, setFilterMember] = useState('All');

  // Form State
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [overridePenalty, setOverridePenalty] = useState(''); // optional manual override
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [penaltySettings, setPenaltySettings] = useState({ percentage: 5, dueDay: 15, gracePeriod: 3 });

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
        const gracePeriod = settingsData.find(s => s.key === 'grace_period_days')?.value || 3;
        let dueDay = settingsData.find(s => s.key === 'monthly_due_day')?.value || 15;

        setPenaltySettings({ percentage: Number(penaltyPct), dueDay: Number(dueDay), gracePeriod: Number(gracePeriod) });
      }

      // Fetch members (Cat A and C only for installments)
      const { data: membersData } = await supabase
        .from('members')
        .select('id, member_code, category, monthly_installment, profiles(full_name)')
        .in('category', ['A', 'C'])
        .eq('status', 'active');
      if (membersData) setMembers(membersData);

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from('savings_installments')
        .select('*, members(member_code, category, profiles(full_name, photo_url))')
        .order('created_at', { ascending: false })
        .limit(50);
      if (txData) setTransactions(txData);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMemberId('');
    setAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setOverridePenalty('');
    setError('');
    setEditingTx(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsFormModalOpen(true);
  };

  const openEditModal = (tx: any) => {
    resetForm();
    setEditingTx(tx);
    setSelectedMemberId(tx.member_id);
    setAmount(String(tx.amount));
    setPaymentDate(tx.payment_date);
    // Leave override blank — penalty auto-recalculates from the (possibly
    // updated) date & amount. Admin can still type a custom value to override.
    setOverridePenalty('');
    setIsFormModalOpen(true);
  };

  // Live preview of what penalty will be saved given current form inputs.
  // Mirrors the logic in handleSaveTransaction so admin sees the impact
  // of editing the date/amount before clicking Save.
  const computePreviewPenalty = (): number => {
    if (overridePenalty !== '' && overridePenalty != null) {
      const p = Number(overridePenalty);
      return isNaN(p) || p < 0 ? 0 : p;
    }
    const member = members.find(m => m.id === selectedMemberId);
    const memberCategory = member?.category ?? editingTx?.members?.category;
    if (memberCategory !== 'C' || !paymentDate || !amount) return 0;

    const payDate = new Date(paymentDate);
    if (isNaN(payDate.getTime())) return 0;
    const dayOfMonth = getDate(payDate);

    let dueDay = Number(penaltySettings?.dueDay);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 15;
    let penaltyPct = Number(penaltySettings?.percentage);
    if (isNaN(penaltyPct) || penaltyPct < 0) penaltyPct = 2;
    let gracePeriod = Number(penaltySettings?.gracePeriod);
    if (isNaN(gracePeriod) || gracePeriod < 0) gracePeriod = 3;

    if (dayOfMonth > (dueDay + gracePeriod)) {
      return (Number(amount) * penaltyPct) / 100;
    }
    return 0;
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    resetForm();
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    try {
      const member = members.find(m => m.id === selectedMemberId);
      // For edit, the member may not be in the active members list (e.g. deactivated).
      // Fall back to the existing transaction's joined member data.
      const memberCategory = member?.category ?? editingTx?.members?.category;
      if (!selectedMemberId) throw new Error('Please select a member');
      if (!paymentDate) throw new Error('Please select a payment date');

      const payDate = new Date(paymentDate);
      if (isNaN(payDate.getTime())) throw new Error('Invalid payment date');

      const dayOfMonth = getDate(payDate);

      // Penalty: use manual override if provided, else auto-calculate.
      let penalty = 0;
      let dueDay = Number(penaltySettings?.dueDay);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 15;

      let penaltyPct = Number(penaltySettings?.percentage);
      if (isNaN(penaltyPct) || penaltyPct < 0) penaltyPct = 2;

      let gracePeriod = Number(penaltySettings?.gracePeriod);
      if (isNaN(gracePeriod) || gracePeriod < 0) gracePeriod = 3;

      if (overridePenalty !== '' && overridePenalty != null) {
        const p = Number(overridePenalty);
        if (isNaN(p) || p < 0) throw new Error('Penalty must be 0 or greater');
        penalty = p;
      } else if (memberCategory === 'C' && dayOfMonth > (dueDay + gracePeriod)) {
        penalty = (Number(amount) * penaltyPct) / 100;
      }

      const monthYear = startOfMonth(payDate);
      const dueDate = setDate(monthYear, dueDay);

      if (editingTx) {
        // UPDATE — keep original receipt_number & member_id (audit trail).
        const { error: updErr } = await supabase
          .from('savings_installments')
          .update({
            amount: Number(amount),
            penalty: penalty,
            payment_date: paymentDate,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            month_year: format(monthYear, 'yyyy-MM-dd'),
          })
          .eq('id', editingTx.id);
        if (updErr) throw updErr;
      } else {
        // INSERT — random suffix prevents UNIQUE-constraint collisions when two admins
        // record a payment in the same second.
        const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        const receiptNumber = `RCPT-${format(new Date(), 'yyyyMMddHHmmss')}-${suffix}`;

        const insertData: any = {
          member_id: selectedMemberId,
          amount: Number(amount),
          penalty: penalty,
          payment_date: paymentDate,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          receipt_number: receiptNumber,
          month_year: format(monthYear, 'yyyy-MM-dd'),
        };

        // Only add created_by if it's a valid UUID (not a mock ID like 'admin-1')
        if (user?.id && user.id.length > 20) {
          insertData.created_by = user.id;
        }

        const { error: insertError } = await supabase
          .from('savings_installments')
          .insert(insertData);

        if (insertError) throw insertError;
      }

      closeFormModal();
      fetchData(); // Refresh
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!txToDelete) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { error: delErr } = await supabase
        .from('savings_installments')
        .delete()
        .eq('id', txToDelete.id);
      if (delErr) throw delErr;
      setTxToDelete(null);
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const txDate = tx.payment_date ? new Date(tx.payment_date) : new Date();
    const safeTxDate = isNaN(txDate.getTime()) ? new Date() : txDate;
    const txMonth = format(safeTxDate, 'yyyy-MM');
    const matchesMonth = filterMonth === '' || txMonth === filterMonth;
    const matchesMember = filterMember === 'All' || tx.member_id === filterMember;
    return matchesMonth && matchesMember;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Savings Transactions</h2>
        <Button onClick={openAddModal} className="gap-2">
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
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No transactions found for selected filters.</td></tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="p-4">{safeFormatDate(tx.payment_date)}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10 shrink-0">
                          {(() => {
                            const profile = Array.isArray(tx.members?.profiles) ? tx.members?.profiles[0] : tx.members?.profiles;
                            const photoUrl = profile?.photo_url;
                            if (photoUrl) {
                              return (
                                <img
                                  src={photoUrl}
                                  alt={profile?.full_name || 'Member'}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              );
                            }
                            return <i className="fas fa-user"></i>;
                          })()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">
                            {Array.isArray(tx.members?.profiles) ? tx.members?.profiles[0]?.full_name : tx.members?.profiles?.full_name}
                          </p>
                          <p className="text-xs font-mono text-[#1e5a48]">{tx.members?.member_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-medium text-green-600">{formatCurrency(tx.amount)}</td>
                    <td className="p-4 text-right text-red-500">{tx.penalty > 0 ? formatCurrency(tx.penalty) : '-'}</td>
                    <td className="p-4 text-right font-bold">{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                    <td className="p-4 text-right space-x-3 whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(tx)}
                        className="text-[#f7b05e] hover:text-[#e09d3e] font-medium text-sm"
                        title="Edit"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => { setDeleteError(''); setTxToDelete(tx); }}
                        className="text-red-500 hover:text-red-700 font-medium text-sm"
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Transaction Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">{editingTx ? 'Edit Installment' : 'Record Installment'}</h3>
              <button onClick={closeFormModal} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}

              <form onSubmit={handleSaveTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Member (Cat A & C only)</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    value={selectedMemberId}
                    onChange={(e) => {
                      const newMemberId = e.target.value;
                      setSelectedMemberId(newMemberId);
                      const selectedMember = members.find(m => m.id === newMemberId);
                      if (selectedMember && selectedMember.monthly_installment) {
                        setAmount(selectedMember.monthly_installment.toString());
                      } else {
                        setAmount('');
                      }
                    }}
                    required
                    disabled={!!editingTx}
                  >
                    <option value="">-- Select Member --</option>
                    {editingTx && !members.find(m => m.id === selectedMemberId) && (
                      <option value={selectedMemberId}>
                        {editingTx.members?.member_code} - {Array.isArray(editingTx.members?.profiles) ? editingTx.members?.profiles[0]?.full_name : editingTx.members?.profiles?.full_name}
                      </option>
                    )}
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.member_code} - {m.profiles?.full_name} (Cat {m.category})
                      </option>
                    ))}
                  </select>
                  {editingTx && <p className="text-xs text-gray-500">Member cannot be changed on edit (audit trail).</p>}
                </div>

                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  <p className="text-xs text-gray-500">Penalty of {penaltySettings.percentage}% auto-applies if date is after the {penaltySettings.dueDay + penaltySettings.gracePeriod}th ({penaltySettings.dueDay}th + {penaltySettings.gracePeriod} days grace).</p>
                </div>

                <div className="space-y-2">
                  <Label>Installment Amount (₹)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="1" />
                </div>

                <div className="space-y-2">
                  <Label>Penalty Override (₹) <span className="text-gray-400 font-normal">— optional</span></Label>
                  <Input
                    type="number"
                    value={overridePenalty}
                    onChange={(e) => setOverridePenalty(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Leave blank to auto-calculate"
                  />
                  {(() => {
                    const preview = computePreviewPenalty();
                    const isOverride = overridePenalty !== '';
                    return (
                      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">
                        <i className="fas fa-calculator text-[#1e5a48] mr-1"></i>
                        Will save: <strong>{formatCurrency(preview)}</strong>{' '}
                        <span className="text-gray-400">
                          ({isOverride ? 'manual override' : (preview > 0 ? 'auto: late payment' : 'auto: within grace period')})
                        </span>
                      </p>
                    );
                  })()}
                  <p className="text-xs text-gray-500">Use 0 to waive a penalty, or set a custom amount. Blank = auto-calc from date.</p>
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? 'Saving…' : (editingTx ? 'Update Transaction' : 'Record Transaction')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Permanently delete this installment? This will reduce the member's total savings.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><span className="text-gray-500">Receipt:</span> <span className="font-mono">{txToDelete.receipt_number}</span></div>
                <div><span className="text-gray-500">Member:</span> <span className="font-medium">{Array.isArray(txToDelete.members?.profiles) ? txToDelete.members?.profiles[0]?.full_name : txToDelete.members?.profiles?.full_name} ({txToDelete.members?.member_code})</span></div>
                <div><span className="text-gray-500">Date:</span> {safeFormatDate(txToDelete.payment_date)}</div>
                <div><span className="text-gray-500">Total:</span> <span className="font-bold">{formatCurrency(Number(txToDelete.amount) + Number(txToDelete.penalty))}</span></div>
              </div>
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setTxToDelete(null)} disabled={deleting}>Cancel</Button>
                <Button onClick={handleDeleteTransaction} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleting ? 'Deleting…' : 'Delete Transaction'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
