import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { safeFormatDate, formatCurrency } from '../lib/utils';
import { translations, useLanguage } from '../lib/lang';

export function MemberTransactions() {
  const { memberId } = useAuth();
  const lang = useLanguage();
  const t = translations[lang];
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (memberId) {
      fetchTransactions();
    }
  }, [memberId]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('savings_installments')
        .select('*')
        .eq('member_id', memberId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      if (data) setTransactions(data);
    } catch (err: any) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.history.title}</h2>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-history text-[#1e5a48]"></i> {t.history.allInstallments}
          </h3>
        </div>
        
        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center"><i className="fas fa-spinner fa-spin text-3xl text-[#f7b05e]"></i></div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t.history.noTx}</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#1a5f4a] text-white">
                <tr>
                  <th className="p-4 font-medium">{t.history.paymentDate}</th>
                  <th className="p-4 font-medium">{t.history.monthYear}</th>
                  <th className="p-4 font-medium">{t.history.receiptNo}</th>
                  <th className="p-4 font-medium text-right">{t.history.principal}</th>
                  <th className="p-4 font-medium text-right">{t.history.penalty}</th>
                  <th className="p-4 font-medium text-right">{t.history.totalPaid}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4">{safeFormatDate(tx.payment_date, 'dd MMM, yyyy')}</td>
                    <td className="p-4 font-medium text-gray-700">{safeFormatDate(tx.month_year, 'MMMM yyyy')}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">{tx.receipt_number}</td>
                    <td className="p-4 text-right text-green-600 font-medium">+{formatCurrency(tx.amount)}</td>
                    <td className="p-4 text-right text-red-500">{Number(tx.penalty) > 0 ? formatCurrency(tx.penalty) : '-'}</td>
                    <td className="p-4 text-right font-bold text-gray-800">{formatCurrency(Number(tx.amount) + Number(tx.penalty))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
