import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { format } from 'date-fns';
import { useAuth } from '../../lib/AuthContext';

export function Loans() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'disburse' | 'repay'>('disburse');
  const [members, setMembers] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Disburse Form State
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [disburseAmount, setDisburseAmount] = useState('');
  const [interestRate, setInterestRate] = useState('2');
  const [disburseDate, setDisburseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eligibility, setEligibility] = useState(0);
  
  // Repay Form State
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [repayPrincipal, setRepayPrincipal] = useState('');
  const [repayInterest, setRepayInterest] = useState('');
  const [repayDate, setRepayDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [loanEligibilityPct, setLoanEligibilityPct] = useState(0.8);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit loan state
  const [editingLoan, setEditingLoan] = useState<any | null>(null);
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editDisburseDate, setEditDisburseDate] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete loan state
  const [deletingLoan, setDeletingLoan] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: settingsRows } = await supabase.from('settings').select('key, value');
      const settingsMap = Object.fromEntries((settingsRows || []).map((s: any) => [s.key, Number(s.value)]));
      const pct = (settingsMap['loan_eligibility_percent'] ?? 80) / 100;
      setLoanEligibilityPct(pct);

      const { data: loansData } = await supabase
        .from('loans')
        .select(`
          *,
          members(member_code, profiles(full_name, photo_url))
        `)
        .eq('status', 'active');
      const loans = loansData ?? [];
      if (loansData) setActiveLoans(loansData);

      const outstandingByMember = new Map<string, number>();
      for (const l of loans) {
        const prev = outstandingByMember.get(l.member_id) ?? 0;
        outstandingByMember.set(l.member_id, prev + Number(l.remaining_principal || 0));
      }

      const { data: membersData } = await supabase
        .from('members')
        .select(`
          id, member_code, category, initial_investment, loan_interest_rate,
          profiles(full_name),
          savings_installments(amount)
        `)
        .eq('status', 'active');

      if (membersData) {
        const processedMembers = membersData.map((m) => {
          const totalInstallments = m.savings_installments?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;
          let totalSavingsForEligibility = 0;
          if (m.category === 'A') totalSavingsForEligibility = Number(m.initial_investment) + totalInstallments;
          else if (m.category === 'B') totalSavingsForEligibility = Number(m.initial_investment);
          else if (m.category === 'C') totalSavingsForEligibility = totalInstallments;

          const outstanding = outstandingByMember.get(m.id) ?? 0;
          const netSavings = Math.max(0, totalSavingsForEligibility - outstanding);

          return {
            ...m,
            totalSavings: totalSavingsForEligibility,
            outstandingLoan: outstanding,
            maxLoan: netSavings * pct,
          };
        });
        setMembers(processedMembers);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedMemberId(id);
    const member = members.find(m => m.id === id);
    if (member) {
      setEligibility(member.maxLoan);
      setInterestRate(member.loan_interest_rate?.toString() || '2');
    } else {
      setEligibility(0);
      setInterestRate('2');
    }
  };

  useEffect(() => {
    if (selectedLoanId) {
      const loan = activeLoans.find(l => l.id === selectedLoanId);
      if (loan) {
        const interestDue = (Number(loan.remaining_principal) * Number(loan.interest_rate)) / 100;
        setRepayInterest(interestDue.toString());
      }
    } else {
      setRepayInterest('');
      setRepayPrincipal('');
    }
  }, [selectedLoanId, activeLoans]);

  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError(''); setSuccessMsg('');

    try {
      const member = members.find(m => m.id === selectedMemberId);
      if (!member) throw new Error('Select a member');
      if (Number(disburseAmount) <= 0) throw new Error('Loan amount must be greater than 0');
      if (Number(disburseAmount) > eligibility) throw new Error(`Amount exceeds 80% eligibility limit (max ${formatCurrency(eligibility)} after subtracting any existing loan)`);

      const insertData: any = {
        member_id: selectedMemberId,
        principal_amount: Number(disburseAmount),
        interest_rate: Number(interestRate),
        disbursed_date: disburseDate,
        remaining_principal: Number(disburseAmount),
      };

      if (user?.id && user.id.length > 20) {
        insertData.approved_by = user.id;
      }

      const { error: insertError } = await supabase
        .from('loans')
        .insert(insertData);

      if (insertError) throw insertError;

      setSuccessMsg('Loan disbursed successfully!');
      fetchData();
      setSelectedMemberId(''); setDisburseAmount('');
    } catch (err: any) {
      setError(err.message || 'Failed to disburse loan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true); setError(''); setSuccessMsg('');

    try {
      const loan = activeLoans.find(l => l.id === selectedLoanId);
      if (!loan) throw new Error('Select a loan');

      const principalPortion = Number(repayPrincipal);
      const interestPortion = Number(repayInterest);
      const amountPaid = principalPortion + interestPortion;
      const outstanding = Number(loan.remaining_principal);

      if (amountPaid <= 0) throw new Error('Total payment must be greater than 0');
      if (principalPortion < 0 || interestPortion < 0) throw new Error('Amounts cannot be negative');
      if (principalPortion > outstanding) {
        throw new Error(`Principal repayment (${formatCurrency(principalPortion)}) cannot exceed outstanding balance (${formatCurrency(outstanding)}).`);
      }

      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const receiptNumber = `LREP-${format(new Date(), 'yyyyMMddHHmmss')}-${suffix}`;

      const { error: rpcError } = await supabase.rpc('record_loan_repayment', {
        p_loan_id: selectedLoanId,
        p_amount_paid: amountPaid,
        p_principal_portion: principalPortion,
        p_interest_portion: interestPortion,
        p_payment_date: repayDate,
        p_receipt_number: receiptNumber,
        p_created_by: user?.id ?? null,
      });
      if (rpcError) throw rpcError;

      setSuccessMsg(`Repayment successful! Principal reduced by ${formatCurrency(principalPortion)}`);
      fetchData();
      setSelectedLoanId(''); setRepayPrincipal(''); setRepayInterest('');
    } catch (err: any) {
      setError(err.message || 'Failed to process repayment');
    } finally {
      setFormLoading(false);
    }
  };

  const openEditLoan = (loan: any) => {
    setEditingLoan(loan);
    setEditPrincipal(String(loan.principal_amount));
    setEditInterestRate(String(loan.interest_rate));
    setEditDisburseDate(loan.disbursed_date);
    setEditError('');
  };

  const handleEditLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true); setEditError('');
    try {
      if (Number(editPrincipal) <= 0) throw new Error('Principal must be greater than 0');
      if (Number(editInterestRate) < 0) throw new Error('Interest rate cannot be negative');

      const principalChange = Number(editPrincipal) - Number(editingLoan.principal_amount);
      const newRemaining = Number(editingLoan.remaining_principal) + principalChange;
      if (newRemaining < 0) throw new Error('New outstanding cannot be negative');

      const { error: updErr } = await supabase
        .from('loans')
        .update({
          principal_amount: Number(editPrincipal),
          interest_rate: Number(editInterestRate),
          disbursed_date: editDisburseDate,
          remaining_principal: newRemaining,
        })
        .eq('id', editingLoan.id);
      if (updErr) throw updErr;

      setEditingLoan(null);
      fetchData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update loan');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteLoan = async () => {
    if (!deletingLoan) return;
    setDeleteLoading(true); setDeleteError('');
    try {
      const { error: delErr } = await supabase
        .from('loans')
        .delete()
        .eq('id', deletingLoan.id);
      if (delErr) throw delErr;
      setDeletingLoan(null);
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete loan');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Loan Management</h2>

      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'disburse' ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setActiveTab('disburse'); setError(''); setSuccessMsg(''); }}
        >
          Disburse New Loan
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'repay' ? 'border-b-2 border-[#1e5a48] text-[#1e5a48]' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => { setActiveTab('repay'); setError(''); setSuccessMsg(''); }}
        >
          Record Repayment
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{error}</div>}
        {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100">{successMsg}</div>}

        {activeTab === 'disburse' ? (
          <form onSubmit={handleDisburse} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Member</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedMemberId} 
                onChange={handleMemberSelect}
                required
              >
                <option value="">-- Select Member --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.member_code} - {m.profiles?.full_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedMemberId && (() => {
              const sel = members.find((m) => m.id === selectedMemberId);
              const totalSav = sel?.totalSavings ?? 0;
              const outstanding = sel?.outstandingLoan ?? 0;
              return (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-800">Total savings (collateral):</span>
                    <span className="text-blue-900 font-medium">{formatCurrency(totalSav)}</span>
                  </div>
                  {outstanding > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-800">Less: existing loan balance:</span>
                      <span className="text-red-700 font-medium">− {formatCurrency(outstanding)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="text-sm text-blue-800 font-medium">Max new loan ({Math.round(loanEligibilityPct * 100)}% of net):</span>
                    <span className="text-lg font-bold text-blue-900">{formatCurrency(eligibility)}</span>
                  </div>
                  {outstanding > 0 && eligibility > 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                      ⚠️ Member already has an active loan. A second loan is allowed but will not be visible in the member's portal until the first is closed.
                    </p>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disbursement Date</Label>
                <Input type="date" value={disburseDate} onChange={(e) => setDisburseDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Interest Rate (% per month)</Label>
                <Input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required min="0" />
                <p className="text-xs text-gray-500">All loan interest is charged monthly on the outstanding principal.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Loan Amount (₹)</Label>
              <Input type="number" value={disburseAmount} onChange={(e) => setDisburseAmount(e.target.value)} required min="1" max={eligibility || undefined} />
            </div>

            <Button type="submit" className="w-full" disabled={formLoading || !selectedMemberId}>
              {formLoading ? 'Processing...' : 'Disburse Loan'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRepay} className="space-y-4">
            <div className="space-y-2">
              <Label>Select Active Loan</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedLoanId} 
                onChange={(e) => setSelectedLoanId(e.target.value)}
                required
              >
                <option value="">-- Select Loan --</option>
                {activeLoans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.members?.member_code} - {l.members?.profiles?.full_name} (Bal: {formatCurrency(l.remaining_principal)})
                  </option>
                ))}
              </select>
            </div>

            {selectedLoanId && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-800 font-medium">Outstanding Principal:</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency(activeLoans.find(l => l.id === selectedLoanId)?.remaining_principal || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-800 font-medium">Estimated Interest (1 mo):</span>
                  <span className="text-lg font-bold text-blue-900">
                    {formatCurrency((Number(activeLoans.find(l => l.id === selectedLoanId)?.remaining_principal || 0) * Number(activeLoans.find(l => l.id === selectedLoanId)?.interest_rate || 0)) / 100)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Principal Amount (₹)</Label>
                  <Input type="number" value={repayPrincipal} onChange={(e) => setRepayPrincipal(e.target.value)} required min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Interest Amount (₹)</Label>
                  <Input type="number" value={repayInterest} onChange={(e) => setRepayInterest(e.target.value)} required min="0" />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={formLoading || !selectedLoanId}>
              {formLoading ? 'Processing...' : 'Record Repayment'}
            </Button>
          </form>
        )}
      </div>

      {/* Active Loans Summary Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800">Active Loans Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Member</th>
                <th className="p-4 font-medium">Disbursed Date</th>
                <th className="p-4 font-medium text-right">Original Amount</th>
                <th className="p-4 font-medium text-right">Interest Rate</th>
                <th className="p-4 font-medium text-right">Outstanding Principal</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : activeLoans.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No active loans found.</td></tr>
              ) : (
                activeLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border border-[#1e5a48]/10 shrink-0">
                          {(() => {
                            const profile = Array.isArray(loan.members?.profiles) ? loan.members?.profiles[0] : loan.members?.profiles;
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
                            {Array.isArray(loan.members?.profiles) ? loan.members?.profiles[0]?.full_name : loan.members?.profiles?.full_name}
                          </p>
                          <p className="text-xs font-mono text-[#1e5a48]">{loan.members?.member_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{safeFormatDate(loan.disbursed_date)}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(loan.principal_amount)}</td>
                    <td className="p-4 text-right text-gray-600">{loan.interest_rate}% / mo</td>
                    <td className="p-4 text-right font-bold text-blue-600">{formatCurrency(loan.remaining_principal)}</td>
                    <td className="p-4 text-right space-x-3 whitespace-nowrap">
                      <button onClick={() => openEditLoan(loan)} className="text-[#f7b05e] hover:text-[#e09d3e] font-medium text-sm" title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { setDeleteError(''); setDeletingLoan(loan); }} className="text-red-500 hover:text-red-700 font-medium text-sm" title="Delete">
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

      {/* Edit Loan Modal */}
      {editingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white">
              <h3 className="font-bold text-lg">Edit Loan</h3>
              <button onClick={() => setEditingLoan(null)} className="text-white/70 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {editError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{editError}</div>}
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-1">
                <div><span className="text-gray-500">Member:</span> <span className="font-medium">{editingLoan.members?.member_code} - {editingLoan.members?.profiles?.full_name}</span></div>
                <div><span className="text-gray-500">Outstanding:</span> <span className="font-medium text-blue-600">{formatCurrency(editingLoan.remaining_principal)}</span></div>
              </div>
              <form onSubmit={handleEditLoan} className="space-y-4">
                <div className="space-y-2">
                  <Label>Disbursement Date</Label>
                  <Input type="date" value={editDisburseDate} onChange={(e) => setEditDisburseDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (% per month)</Label>
                  <Input type="number" step="0.1" value={editInterestRate} onChange={(e) => setEditInterestRate(e.target.value)} required min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Principal Amount (₹)</Label>
                  <Input type="number" value={editPrincipal} onChange={(e) => setEditPrincipal(e.target.value)} required min="1" />
                  <p className="text-xs text-gray-500">Changing principal adjusts outstanding balance accordingly.</p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditingLoan(null)} disabled={editLoading}>Cancel</Button>
                  <Button type="submit" disabled={editLoading}>{editLoading ? 'Saving...' : 'Update Loan'}</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Loan Confirmation Modal */}
      {deletingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-red-50 text-red-800 flex items-center gap-3">
              <i className="fas fa-exclamation-triangle text-xl"></i>
              <h3 className="font-bold text-lg">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">Permanently delete this loan? This action cannot be undone.</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><span className="text-gray-500">Member:</span> <span className="font-medium">{deletingLoan.members?.member_code} - {deletingLoan.members?.profiles?.full_name}</span></div>
                <div><span className="text-gray-500">Principal:</span> {formatCurrency(deletingLoan.principal_amount)}</div>
                <div><span className="text-gray-500">Outstanding:</span> <span className="font-medium">{formatCurrency(deletingLoan.remaining_principal)}</span></div>
              </div>
              {deleteError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">{deleteError}</div>}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setDeletingLoan(null)} disabled={deleteLoading}>Cancel</Button>
                <Button onClick={handleDeleteLoan} disabled={deleteLoading} className="bg-red-600 hover:bg-red-700 text-white">
                  {deleteLoading ? 'Deleting...' : 'Delete Loan'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
