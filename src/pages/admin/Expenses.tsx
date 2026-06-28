import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency, safeFormatDate } from '../../lib/utils';
import { format } from 'date-fns';

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Office', 'Maintenance', 'Travel', 'Misc'];

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
};

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState({ category: 'Misc', description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchExpenses(); }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (filter === 'All') return expenses;
    return expenses.filter(e => e.category === filter);
  }, [expenses, filter]);

  const thisMonth = useMemo(() => {
    const now = new Date();
    return expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [expenses]);

  const totalAll = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const totalMonth = useMemo(() => thisMonth.reduce((s, e) => s + Number(e.amount), 0), [thisMonth]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    await supabase.from('expenses').insert({
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      date: form.date,
    });
    setForm({ category: 'Misc', description: '', amount: '', date: format(new Date(), 'yyyy-MM-dd') });
    await fetchExpenses();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('expenses').delete().eq('id', id);
    await fetchExpenses();
  };

  const handleExport = () => {
    const rows: string[][] = [
      ['EUS Expenses Report', '', format(new Date(), 'dd-MMM-yyyy')],
      [],
      ['Total This Month', formatCurrency(totalMonth)],
      ['Total All Time', formatCurrency(totalAll)],
      [],
      ['Date', 'Category', 'Description', 'Amount'],
    ];
    filtered.forEach(exp => {
      rows.push([safeFormatDate(exp.date), exp.category, exp.description, formatCurrency(exp.amount)]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EUS_Expenses_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6">Loading expenses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Expenses</h2>
        <button onClick={handleExport} className="bg-[#1e5a48] hover:bg-[#154234] text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all">
          <i className="fas fa-download"></i> Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-[#fdecea] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#f0cac8]">
          <p className="text-xs sm:text-sm text-[#b55a5a] font-medium mb-1">This Month</p>
          <p className="text-xl sm:text-3xl font-bold text-gray-800">{formatCurrency(totalMonth)}</p>
        </div>
        <div className="bg-[#e8f5f1] rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-[#c8e6dd]">
          <p className="text-xs sm:text-sm text-[#3d7a68] font-medium mb-1">All Time</p>
          <p className="text-xl sm:text-3xl font-bold text-gray-800">{formatCurrency(totalAll)}</p>
        </div>
      </div>

      {/* Add Expense Form */}
      <form onSubmit={handleAdd} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Expense</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5a48]/30"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Office electricity bill"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5a48]/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Amount (₹)</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5a48]/30"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5a48]/30"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving || !form.amount}
          className="mt-4 bg-[#1e5a48] hover:bg-[#154234] disabled:opacity-50 text-white px-6 py-2.5 rounded-full text-sm font-medium transition-all"
        >
          {saving ? 'Adding...' : 'Add Expense'}
        </button>
      </form>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        {['All', ...CATEGORIES].map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === c ? 'bg-[#1e5a48] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium text-right">Amount</th>
              <th className="px-6 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No expenses found.</td></tr>
            ) : (
              filtered.map(exp => (
                <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-3.5 text-gray-700">{safeFormatDate(exp.date)}</td>
                  <td className="px-6 py-3.5">
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-medium">{exp.category}</span>
                  </td>
                  <td className="px-6 py-3.5 text-gray-600">{exp.description || '—'}</td>
                  <td className="px-6 py-3.5 text-right font-semibold text-gray-800">{formatCurrency(exp.amount)}</td>
                  <td className="px-6 py-3.5 text-right">
                    <button onClick={() => handleDelete(exp.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete">
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
  );
}
