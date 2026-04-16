import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button, Input, Label } from '../../components/ui/basic';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { format, addMonths, isBefore, isAfter } from 'date-fns';
import * as XLSX from 'xlsx';

import { ExternalLoans } from './ExternalLoans';

export function Investments() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'loans'>('portfolio');
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // Add Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('Business');
  const [principal, setPrincipal] = useState('');
  const [expectedRoi, setExpectedRoi] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [maturityDate, setMaturityDate] = useState('');
  const [payoutFrequency, setPayoutFrequency] = useState('Monthly');
  const [notes, setNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Return Form State
  const [returnAmount, setReturnAmount] = useState('');
  const [returnDate, setReturnDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnDesc, setReturnDesc] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('external_investments')
        .select('*, investment_returns(*)');

      if (fetchError) {
        if (fetchError.code === '42P01' || fetchError.message?.includes('schema cache') || fetchError.message?.includes('Could not find the table')) {
          // Table does not exist
          setNeedsSetup(true);
        } else {
          throw fetchError;
        }
      } else {
        setInvestments(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching investments:', err);
      if (err.message?.includes('schema cache') || err.message?.includes('Could not find the table')) {
        setNeedsSetup(true);
      } else {
        setError(err.message || 'Failed to load investments.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const payload = {
        name,
        type,
        principal_amount: Number(principal),
        expected_roi: expectedRoi ? Number(expectedRoi) : null,
        start_date: startDate,
        maturity_date: maturityDate || null,
        payout_frequency: payoutFrequency,
        notes,
      };

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('external_investments')
          .update(payload)
          .eq('id', selectedInvestmentId);
        if (updateError) throw updateError;
        setSuccessMsg('Investment updated successfully!');
      } else {
        const { error: insertError } = await supabase
          .from('external_investments')
          .insert({ ...payload, status: 'Active' });
        if (insertError) throw insertError;
        setSuccessMsg('Investment added successfully!');
      }

      setIsAddModalOpen(false);
      resetAddForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save investment');
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('investment_returns')
        .insert({
          investment_id: selectedInvestmentId,
          amount: Number(returnAmount),
          return_date: returnDate,
          description: returnDesc
        });

      if (insertError) throw insertError;

      setSuccessMsg('Return recorded successfully!');
      setIsReturnModalOpen(false);
      setReturnAmount('');
      setReturnDate(format(new Date(), 'yyyy-MM-dd'));
      setReturnDesc('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to record return');
    } finally {
      setFormLoading(false);
    }
  };

  const resetAddForm = () => {
    setIsEditMode(false);
    setSelectedInvestmentId('');
    setName('');
    setType('Business');
    setPrincipal('');
    setExpectedRoi('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setMaturityDate('');
    setPayoutFrequency('Monthly');
    setNotes('');
  };

  const handleDeleteInvestment = async () => {
    setFormLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('external_investments')
        .delete()
        .eq('id', selectedInvestmentId);

      if (deleteError) throw deleteError;

      setSuccessMsg('Investment deleted successfully!');
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete investment');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditClick = (inv: any) => {
    setIsEditMode(true);
    setSelectedInvestmentId(inv.id);
    setName(inv.name);
    setType(inv.type);
    setPrincipal(inv.principal_amount.toString());
    setExpectedRoi(inv.expected_roi ? inv.expected_roi.toString() : '');
    setStartDate(inv.start_date || '');
    setMaturityDate(inv.maturity_date || '');
    setPayoutFrequency(inv.payout_frequency || 'Monthly');
    setNotes(inv.notes || '');
    setIsAddModalOpen(true);
  };

  const exportToExcel = () => {
    const exportData = investments.map(inv => {
      const totalReturns = inv.investment_returns?.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0;
      return {
        'Investment Name': inv.name,
        'Type': inv.type,
        'Principal Amount': inv.principal_amount,
        'Expected ROI (%)': inv.expected_roi || 'N/A',
        'Start Date': inv.start_date,
        'Maturity Date': inv.maturity_date || 'N/A',
        'Total Returns Earned': totalReturns,
        'Current Value': Number(inv.principal_amount) + totalReturns,
        'Status': inv.status,
        'Payout Frequency': inv.payout_frequency,
        'Notes': inv.notes
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Investments');
    XLSX.writeFile(wb, `EUS_Investments_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  if (needsSetup) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fas fa-database"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Database Setup Required</h2>
          <p className="text-gray-600 mb-6">The tables for External Investments don't exist yet. Please run the following SQL script in your Supabase SQL Editor to create them.</p>
          
          <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-left overflow-x-auto text-sm font-mono mb-6">
            <pre>{`-- Run this in Supabase SQL Editor
CREATE TABLE external_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  principal_amount NUMERIC NOT NULL,
  expected_roi NUMERIC,
  start_date DATE NOT NULL,
  maturity_date DATE,
  payout_frequency TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE investment_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investment_id UUID REFERENCES external_investments(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  return_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for easy admin access (or configure policies as needed)
ALTER TABLE external_investments DISABLE ROW LEVEL SECURITY;
ALTER TABLE investment_returns DISABLE ROW LEVEL SECURITY;`}</pre>
          </div>
          
          <Button onClick={() => window.location.reload()}>I have run the script, reload page</Button>
        </div>
      </div>
    );
  }

  // Calculations for Summary Cards
  const activeInvestments = investments.filter(i => i.status === 'Active');
  const totalInvested = activeInvestments.reduce((sum, i) => sum + Number(i.principal_amount), 0);
  const totalReturns = investments.reduce((sum, i) => {
    const returnsForInv = i.investment_returns?.reduce((rSum: number, r: any) => rSum + Number(r.amount), 0) || 0;
    return sum + returnsForInv;
  }, 0);
  const currentValue = totalInvested + totalReturns;

  // Maturity Calendar (Next 3 Months)
  const threeMonthsFromNow = addMonths(new Date(), 3);
  const maturingSoon = activeInvestments.filter(i => {
    if (!i.maturity_date) return false;
    const mDate = new Date(i.maturity_date);
    return isAfter(mDate, new Date()) && isBefore(mDate, threeMonthsFromNow);
  }).sort((a, b) => new Date(a.maturity_date).getTime() - new Date(b.maturity_date).getTime());

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Organization Investments</h2>
        <div className="flex bg-gray-200 p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'portfolio' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('portfolio')}
          >
            Portfolio
          </button>
          <button
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'loans' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={() => setActiveTab('loans')}
          >
            External Loans
          </button>
        </div>
      </div>

      {activeTab === 'portfolio' && (
        <>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={exportToExcel} className="gap-2">
              <i className="fas fa-file-excel text-green-600"></i> Export
            </Button>
            <Button onClick={() => { resetAddForm(); setIsAddModalOpen(true); }} className="gap-2">
              <i className="fas fa-plus"></i> New Investment
            </Button>
          </div>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">{error}</div>}
          {successMsg && <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-100">{successMsg}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
            <i className="fas fa-wallet"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Invested (Active)</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalInvested)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl shrink-0">
            <i className="fas fa-chart-line"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Current Value</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(currentValue)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center text-xl shrink-0">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Returns Earned</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalReturns)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">
            <i className="fas fa-briefcase"></i>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Investments</p>
            <p className="text-2xl font-bold text-gray-800">{activeInvestments.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">Investment Portfolio</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Investment</th>
                  <th className="p-4 font-medium text-right">Principal</th>
                  <th className="p-4 font-medium text-right">Returns</th>
                  <th className="p-4 font-medium text-right">Current Value</th>
                  <th className="p-4 font-medium text-center">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading portfolio...</td></tr>
                ) : investments.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No investments found.</td></tr>
                ) : (
                  investments.map((inv) => {
                    const invReturns = inv.investment_returns?.reduce((sum: number, r: any) => sum + Number(r.amount), 0) || 0;
                    const invCurrentValue = Number(inv.principal_amount) + invReturns;
                    
                    return (
                      <tr key={inv.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="font-bold text-gray-800">{inv.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{inv.type}</span>
                            {inv.expected_roi && <span>{inv.expected_roi}% ROI</span>}
                          </div>
                        </td>
                        <td className="p-4 text-right font-medium">{formatCurrency(inv.principal_amount)}</td>
                        <td className="p-4 text-right text-green-600">+{formatCurrency(invReturns)}</td>
                        <td className="p-4 text-right font-bold text-[#1e5a48]">{formatCurrency(invCurrentValue)}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            inv.status === 'Active' ? 'bg-green-100 text-green-700' :
                            inv.status === 'Matured' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {inv.status === 'Active' && (
                            <button 
                              onClick={() => { setSelectedInvestmentId(inv.id); setIsReturnModalOpen(true); }}
                              className="text-sm text-[#f7b05e] hover:text-[#e09b4d] font-medium bg-[#f7b05e]/10 px-3 py-1.5 rounded-lg transition-colors"
                              title="Add Return"
                            >
                              + Add Return
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(inv)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                            title="Edit Investment"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => { setSelectedInvestmentId(inv.id); setIsDeleteModalOpen(true); }}
                            className="text-sm text-red-600 hover:text-red-800 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                            title="Delete Investment"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maturity Calendar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <i className="fas fa-calendar-alt text-[#f7b05e]"></i> Maturity Calendar
            </h3>
            <p className="text-xs text-gray-500 mt-1">Maturing in next 3 months</p>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {maturingSoon.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <i className="fas fa-check-circle text-3xl text-gray-300 mb-2 block"></i>
                No investments maturing soon.
              </div>
            ) : (
              <div className="space-y-4">
                {maturingSoon.map(inv => (
                  <div key={inv.id} className="p-4 rounded-xl border border-orange-100 bg-orange-50/50 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">{inv.name}</p>
                      <p className="text-xs text-gray-500 mt-1">Principal: {formatCurrency(inv.principal_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">{safeFormatDate(inv.maturity_date)}</p>
                      <p className="text-xs text-orange-500 mt-0.5">Maturity Date</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Investment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center bg-[#0b3b2f] text-white shrink-0">
              <h3 className="font-bold text-lg">{isEditMode ? 'Edit Investment' : 'Add New Investment'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSaveInvestment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Investment Name / Entity</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. ABC Corp Stocks" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={type} 
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="Business">Business</option>
                      <option value="Stocks">Stocks / Mutual Funds</option>
                      <option value="SIP">SIP</option>
                      <option value="Personal Loan">Personal Loan (Non-Member)</option>
                      <option value="Real Estate">Real Estate</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Principal Amount (₹)</Label>
                    <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} required min="1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected ROI (%) <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <Input type="number" step="0.1" value={expectedRoi} onChange={(e) => setExpectedRoi(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Maturity Date <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Payout Frequency</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={payoutFrequency} 
                      onChange={(e) => setPayoutFrequency(e.target.value)}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Annually">Annually</option>
                      <option value="At Maturity">At Maturity</option>
                      <option value="Irregular">Irregular / Variable</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes / Details <span className="text-gray-400 font-normal">(Optional)</span></Label>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional terms, account numbers, or details..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? 'Saving...' : 'Save Investment'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Return Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-[#1e5a48] text-white shrink-0">
              <h3 className="font-bold text-lg">Record Return / Dividend</h3>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-white/70 hover:text-white">
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleAddReturn} className="space-y-4">
                <div className="space-y-2">
                  <Label>Return Amount (₹)</Label>
                  <Input type="number" value={returnAmount} onChange={(e) => setReturnAmount(e.target.value)} required min="1" />
                </div>
                <div className="space-y-2">
                  <Label>Date Received</Label>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description / Reference <span className="text-gray-400 font-normal">(Optional)</span></Label>
                  <Input value={returnDesc} onChange={(e) => setReturnDesc(e.target.value)} placeholder="e.g. Q1 Dividend, Interest payment" />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsReturnModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={formLoading}>
                    {formLoading ? 'Saving...' : 'Record Return'}
                  </Button>
                </div>
              </form>
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
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Investment?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this investment? This action cannot be undone and will also delete all associated return records.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white" 
                  onClick={handleDeleteInvestment}
                  disabled={formLoading}
                >
                  {formLoading ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {activeTab === 'loans' && (
        <ExternalLoans />
      )}
    </div>
  );
}
