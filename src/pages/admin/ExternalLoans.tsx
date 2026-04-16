import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { format, addMonths, isBefore, isAfter, parseISO } from 'date-fns';

export function ExternalLoans() {
  const [loans, setLoans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Form State - Loan
  const [borrowerName, setBorrowerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [idProof, setIdProof] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [status, setStatus] = useState('Active');
  const [formLoading, setFormLoading] = useState(false);

  // Form State - Payment
  const [paymentType, setPaymentType] = useState('Interest Paid');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [loansRes, txnsRes] = await Promise.all([
        supabase.from('ext_loans').select('*').order('created_at', { ascending: false }),
        supabase.from('ext_loan_txns').select('*').order('txn_date', { ascending: false })
      ]);

      if (loansRes.error) throw loansRes.error;
      if (txnsRes.error) throw txnsRes.error;

      const fetchedLoans = loansRes.data || [];
      const fetchedTxns = txnsRes.data || [];

      setLoans(fetchedLoans);
      setTransactions(fetchedTxns);

      // Auto-generate missing interest dues
      await autoGenerateInterest(fetchedLoans, fetchedTxns);

    } catch (err: any) {
      console.error('Error fetching external loans:', err);
      if (err.code === '42P01' || err.message?.includes('schema cache') || err.message?.includes('Could not find the table')) {
        setNeedsSetup(true);
      } else {
        setError(err.message || 'Failed to load external loans.');
      }
    } finally {
      setLoading(false);
    }
  };

  const autoGenerateInterest = async (fetchedLoans: any[], fetchedTxns: any[]) => {
    const insertQueue: any[] = [];
    const today = new Date();

    for (const loan of fetchedLoans) {
      if (loan.status !== 'Active') continue;
      
      let currentMonthDate = addMonths(parseISO(loan.start_date), 1);
      
      // Loop month by month up to current date
      while (isBefore(currentMonthDate, today) || format(currentMonthDate, 'yyyy-MM') === format(today, 'yyyy-MM')) {
        const monthStr = format(currentMonthDate, 'yyyy-MM');
        
        // Check if interest due already exists for this month
        const hasDueForMonth = fetchedTxns.some(t => 
          t.loan_id === loan.id && 
          t.type === 'Interest Due' && 
          t.txn_date.startsWith(monthStr)
        );

        if (!hasDueForMonth) {
          insertQueue.push({
            loan_id: loan.id,
            type: 'Interest Due',
            amount: (Number(loan.principal_amount) * Number(loan.interest_rate)) / 100,
            txn_date: format(currentMonthDate, 'yyyy-MM-dd'),
            notes: `Auto-generated interest for ${format(currentMonthDate, 'MMMM yyyy')}`,
            receipt_number: null
          });
        }
        currentMonthDate = addMonths(currentMonthDate, 1);
      }
    }

    if (insertQueue.length > 0) {
      const { error } = await supabase.from('ext_loan_txns').insert(insertQueue);
      if (!error) {
        // Soft refresh txns if inserted
        const { data } = await supabase.from('ext_loan_txns').select('*').order('txn_date', { ascending: false });
        if (data) setTransactions(data);
      }
    }
  };

  const resetAddForm = () => {
    setIsEditMode(false);
    setSelectedLoanId('');
    setBorrowerName('');
    setPhone('');
    setAddress('');
    setIdProof('');
    setPrincipal('');
    setInterestRate('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setStatus('Active');
  };

  const handleEditClick = (loan: any) => {
    setIsEditMode(true);
    setSelectedLoanId(loan.id);
    setBorrowerName(loan.borrower_name);
    setPhone(loan.phone || '');
    setAddress(loan.address || '');
    setIdProof(loan.id_proof || '');
    setPrincipal(loan.principal_amount.toString());
    setInterestRate(loan.interest_rate.toString());
    setStartDate(loan.start_date);
    setStatus(loan.status || 'Active');
    setIsAddModalOpen(true);
  };

  const handleDeleteLoan = async () => {
    setFormLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('ext_loans')
        .delete()
        .eq('id', selectedLoanId);

      if (deleteError) throw deleteError;

      setSuccessMsg('Loan deleted successfully!');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete loan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const payload = {
        borrower_name: borrowerName,
        phone,
        address,
        id_proof: idProof,
        principal_amount: Number(principal),
        interest_rate: Number(interestRate),
        start_date: startDate,
      };

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('ext_loans')
          .update({ ...payload, status })
          .eq('id', selectedLoanId);
        if (updateError) throw updateError;
        setSuccessMsg('Borrower updated successfully!');
      } else {
        const { error: insertError } = await supabase
          .from('ext_loans')
          .insert({ ...payload, status: 'Active' });
        if (insertError) throw insertError;
        setSuccessMsg('Borrower & Loan added successfully!');
      }

      setIsAddModalOpen(false);
      resetAddForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save loan');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const receiptNumber = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const { error: insertError } = await supabase
        .from('ext_loan_txns')
        .insert({
          loan_id: selectedLoanId,
          type: paymentType,
          amount: Number(paymentAmount),
          txn_date: paymentDate,
          receipt_number: receiptNumber,
          notes: paymentNotes
        });

      if (insertError) throw insertError;

      // If principal paid, we might want to check for full closure
      // But keeping it simple for now and letting admin close manually if needed

      setSuccessMsg(`${paymentType} recorded with Receipt #${receiptNumber}!`);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchData(); // refresh txns
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setFormLoading(false);
    }
  };

  if (needsSetup) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-6">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
          <i className="fas fa-database"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Notice: Personal Loans Module Missing</h2>
        <p className="text-gray-600 mb-6">The database tables for External Personal Loans are not set up yet. Please run this script in your Supabase SQL Editor.</p>
        
        <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-left overflow-x-auto text-sm font-mono mb-6">
          <pre>{`-- Run this in Supabase SQL Editor
CREATE TABLE ext_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  borrower_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  id_proof TEXT,
  principal_amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ext_loan_txns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES ext_loans(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'Interest Due', 'Interest Paid', 'Principal Paid'
  amount NUMERIC NOT NULL,
  txn_date DATE NOT NULL,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE ext_loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE ext_loan_txns DISABLE ROW LEVEL SECURITY;`}</pre>
        </div>
        
        <Button onClick={() => window.location.reload()}>I have run the script, reload</Button>
      </div>
    );
  }

  const selectedLoan = loans.find(l => l.id === selectedLoanId);
  const selectedLoanTxns = transactions.filter(t => t.loan_id === selectedLoanId);
  
  // Calculate selected loan summary
  const totalInterestDue = selectedLoanTxns.filter(t => t.type === 'Interest Due').reduce((s, t) => s + Number(t.amount), 0);
  const totalInterestPaid = selectedLoanTxns.filter(t => t.type === 'Interest Paid').reduce((s, t) => s + Number(t.amount), 0);
  const totalPrincipalPaid = selectedLoanTxns.filter(t => t.type === 'Principal Paid').reduce((s, t) => s + Number(t.amount), 0);
  const currentPrincipal = selectedLoan ? Number(selectedLoan.principal_amount) - totalPrincipalPaid : 0;
  const balanceInterest = totalInterestDue - totalInterestPaid;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 text-lg">External Personal Loans</h3>
        <Button onClick={() => { resetAddForm(); setIsAddModalOpen(true); }} className="gap-2">
          <i className="fas fa-user-plus"></i> New Borrower & Loan
        </Button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">{error}</div>}
      {successMsg && <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100">{successMsg}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-medium">Borrower</th>
                <th className="p-4 font-medium">Contact Details</th>
                <th className="p-4 font-medium text-right">Original Principal</th>
                <th className="p-4 font-medium text-right">Interest Rate</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading loans...</td></tr>
              ) : loans.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No external personal loans found.</td></tr>
              ) : (
                loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{loan.borrower_name}</div>
                      <div className="text-xs text-gray-500">Started: {safeFormatDate(loan.start_date)}</div>
                    </td>
                    <td className="p-4 text-gray-600">
                      <div><i className="fas fa-phone mr-1 text-gray-400"></i> {loan.phone || '-'}</div>
                      <div className="text-xs truncate max-w-[150px]" title={loan.address}><i className="fas fa-map-marker-alt mr-1 text-gray-400"></i> {loan.address || '-'}</div>
                    </td>
                    <td className="p-4 text-right font-bold text-gray-800">{formatCurrency(loan.principal_amount)}</td>
                    <td className="p-4 text-right text-orange-600 font-medium">{loan.interest_rate}% / mo</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        loan.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => { setSelectedLoanId(loan.id); setIsLedgerModalOpen(true); }}
                        className="text-sm text-[#1e5a48] hover:text-[#0b3b2f] font-medium bg-[#1e5a48]/10 hover:bg-[#1e5a48]/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Ledger & Payments
                      </button>
                      <button
                        onClick={() => handleEditClick(loan)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        title="Edit Borrower"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        onClick={() => { setSelectedLoanId(loan.id); setIsDeleteModalOpen(true); }}
                        className="text-sm text-red-600 hover:text-red-800 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                        title="Delete Loan"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Borrower Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white shrink-0">
              <h3 className="font-bold text-lg">{isEditMode ? 'Edit Borrower & Loan' : 'New External Borrower'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSaveLoan} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Borrower Name</Label>
                    <Input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} required placeholder="Full Name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
                  </div>
                  <div className="space-y-2">
                    <Label>ID Proof Details</Label>
                    <Input value={idProof} onChange={(e) => setIdProof(e.target.value)} placeholder="Aadhar / PAN number" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full Address" />
                  </div>
                  <div className="space-y-2">
                    <Label>Principal Disbursed (₹)</Label>
                    <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} required min="1" disabled={isEditMode} />
                    {isEditMode && <p className="text-xs text-gray-500">Principal cannot be changed after creation. Use principal payments in ledger.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Interest Rate (%)</Label>
                    <Input type="number" step="0.1" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Disbursement / Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required disabled={isEditMode} />
                  </div>
                  {isEditMode && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Loan Status</Label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                        value={status} 
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="Active">Active</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? 'Saving...' : 'Save Details'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {isLedgerModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#1e5a48] text-white shrink-0">
              <h3 className="font-bold text-lg">Loan Ledger: {selectedLoan.borrower_name}</h3>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={handlePrint} className="bg-white/10 hover:bg-white/20 border-white/20 text-white">
                  <i className="fas fa-print mr-2"></i> Print PDF
                </Button>
                <button onClick={() => setIsLedgerModalOpen(false)} className="text-white/70 hover:text-white">
                  <i className="fas fa-times text-xl"></i>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row relative">
              
              {/* Ledger Summary & Print Area */}
              <div className="flex-1 p-6 border-r border-gray-100 overflow-y-auto" id="printable-statement">
                <div className="mb-6 flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{selectedLoan.borrower_name}</h2>
                    <p className="text-gray-500"><i className="fas fa-phone mr-1"></i> {selectedLoan.phone}</p>
                    <p className="text-gray-500"><i className="fas fa-map-marker-alt mr-1"></i> {selectedLoan.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Original Principal: <strong className="text-gray-800">{formatCurrency(selectedLoan.principal_amount)}</strong></p>
                    <p className="text-sm text-gray-500">Interest Rate: <strong className="text-gray-800">{selectedLoan.interest_rate}% / Month</strong></p>
                    <p className="text-sm text-gray-500">Start Date: <strong className="text-gray-800">{safeFormatDate(selectedLoan.start_date)}</strong></p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500">Current Principal</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(currentPrincipal)}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <p className="text-xs text-orange-600">Total Interest Due</p>
                    <p className="text-xl font-bold text-orange-700">{formatCurrency(totalInterestDue)}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <p className="text-xs text-green-600">Total Interest Paid</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(totalInterestPaid)}</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${balanceInterest > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    <p className={`text-xs ${balanceInterest > 0 ? 'text-red-600' : 'text-gray-500'}`}>Balance Interest Dues</p>
                    <p className={`text-xl font-bold ${balanceInterest > 0 ? 'text-red-700' : 'text-gray-800'}`}>{formatCurrency(balanceInterest)}</p>
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Transaction History</h4>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-100 rounded-lg">
                        <th className="p-3 font-medium text-gray-600">Date</th>
                        <th className="p-3 font-medium text-gray-600">Type</th>
                        <th className="p-3 font-medium text-gray-600">Receipt</th>
                        <th className="p-3 font-medium text-gray-600 text-right">Debit / Due</th>
                        <th className="p-3 font-medium text-gray-600 text-right">Credit / Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedLoanTxns.map((txn) => (
                        <tr key={txn.id}>
                          <td className="p-3 text-gray-600">{safeFormatDate(txn.txn_date)}</td>
                          <td className="p-3 font-medium text-gray-800">
                            {txn.type}
                            {txn.notes && <p className="text-xs text-gray-400 font-normal">{txn.notes}</p>}
                          </td>
                          <td className="p-3 font-mono text-xs">{txn.receipt_number || '-'}</td>
                          <td className="p-3 text-right font-medium text-orange-600">
                            {txn.type === 'Interest Due' ? formatCurrency(txn.amount) : '-'}
                          </td>
                          <td className="p-3 text-right font-medium text-green-600">
                            {txn.type !== 'Interest Due' ? formatCurrency(txn.amount) : '-'}
                          </td>
                        </tr>
                      ))}
                      {selectedLoanTxns.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-gray-500">No transactions recorded yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Entry Form (Right sidebar on Desktop, bottom on Mobile) */}
              <div className="w-full md:w-80 bg-gray-50 p-6 flex flex-col border-t md:border-t-0 shrink-0 print:hidden">
                <h4 className="font-bold text-gray-800 mb-4 bg-white px-3 py-1 rounded inline-block border shadow-sm">Record Payment</h4>
                <form onSubmit={handleAddPayment} className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <Label>Payment Type</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                      value={paymentType} 
                      onChange={(e) => setPaymentType(e.target.value)}
                    >
                      <option value="Interest Paid">Interest Paid</option>
                      <option value="Principal Paid">Principal Paid (Repayment)</option>
                    </select>
                  </div>
                  
                  {paymentType === 'Interest Paid' && balanceInterest > 0 && (
                    <div className="bg-orange-50 text-orange-700 text-xs p-2 rounded border border-orange-100 mt-1">
                      <i className="fas fa-info-circle mr-1"></i> Balance Due: <strong className="font-mono">{formatCurrency(balanceInterest)}</strong>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Amount (₹)</Label>
                    <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required min="1" max={paymentType === 'Interest Paid' ? balanceInterest + 5000 : currentPrincipal} />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Date</Label>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Cash, Bank Transfer, etc." />
                  </div>

                  <div className="pt-4">
                    <Button type="submit" className="w-full bg-[#1e5a48] hover:bg-[#154636]" disabled={formLoading}>
                      <i className="fas fa-check-circle mr-2"></i> {formLoading ? 'Saving...' : 'Add Payment'}
                    </Button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Loan?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this loan? This action cannot be undone and will also delete all associated transactions.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white" 
                  onClick={handleDeleteLoan}
                  disabled={formLoading}
                >
                  {formLoading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
