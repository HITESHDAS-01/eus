import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../../components/ui/basic';
import { safeFormatDate, formatCurrency } from '../../../lib/utils';

// ---------------------------------------------------------------------------
// EMI Customer Profile — full detail page for a single EMI customer.
// Mirrors the member-profile pattern but lives under /admin/emi/customers/:id.
// ---------------------------------------------------------------------------

type Customer = {
  id: string;
  customer_code: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  father_husband_name: string | null;
  date_of_birth: string | null;
  aadhaar_vid: string | null;
  pan_number: string | null;
  occupation: string | null;
  monthly_income: number | null;
  nominee_name: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
};

type EmiLoanSummary = {
  id: string;
  loan_code: string;
  product_name: string;
  product_price: number;
  financed_amount: number;
  emi_amount: number;
  remaining_principal: number;
  tenure_months: number;
  status: string;
  disbursed_date: string;
};

export function EmiCustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loans, setLoans] = useState<EmiLoanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (id) fetchData(id); }, [id]);

  const fetchData = async (customerId: string) => {
    setLoading(true);
    setError('');
    try {
      const { data: cust, error: custErr } = await supabase
        .from('emi_customers')
        .select('*')
        .eq('id', customerId)
        .single();
      if (custErr) throw custErr;
      setCustomer(cust);

      // Try to fetch this customer's loans (table may be empty / unused yet).
      const { data: loanData } = await supabase
        .from('emi_loans')
        .select('id, loan_code, product_name, product_price, financed_amount, emi_amount, remaining_principal, tenure_months, status, disbursed_date')
        .eq('customer_id', customerId)
        .order('disbursed_date', { ascending: false });
      setLoans(loanData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <i className="fas fa-spinner fa-spin text-4xl text-[#f7b05e]"></i>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate('/admin/emi')} className="gap-2">
          <i className="fas fa-arrow-left"></i> Back to Customers
        </Button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
          <p className="font-bold mb-1">Could not load customer</p>
          <p className="text-sm">{error || 'Customer not found.'}</p>
        </div>
      </div>
    );
  }

  const activeLoans  = loans.filter(l => l.status === 'active');
  const closedLoans  = loans.filter(l => l.status !== 'active');
  const totalFinanced = loans.reduce((s, l) => s + Number(l.financed_amount || 0), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.remaining_principal || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Back button */}
      <Button variant="outline" onClick={() => navigate('/admin/emi')} className="gap-2">
        <i className="fas fa-arrow-left"></i> Back to Customers
      </Button>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-[#1e5a48]/10 flex items-center justify-center text-[#1e5a48] overflow-hidden border-4 border-white shadow-md text-3xl shrink-0">
            {customer.photo_url ? (
              <img src={customer.photo_url} alt={customer.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <i className="fas fa-user"></i>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-800">{customer.full_name}</h1>
            <p className="font-mono text-sm text-[#1e5a48] mt-1">{customer.customer_code}</p>
            <p className="text-xs text-gray-500 mt-2">
              Joined {safeFormatDate(customer.created_at, 'dd MMM, yyyy')}
            </p>
          </div>
        </div>
      </div>

      {/* Loans summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon="fas fa-mobile-alt"
          color="bg-blue-100 text-blue-700"
          label="Active EMI Loans"
          value={activeLoans.length.toString()}
        />
        <KpiCard
          icon="fas fa-rupee-sign"
          color="bg-green-100 text-green-700"
          label="Total Financed"
          value={formatCurrency(totalFinanced)}
        />
        <KpiCard
          icon="fas fa-hourglass-half"
          color="bg-orange-100 text-orange-700"
          label="Outstanding Balance"
          value={formatCurrency(totalOutstanding)}
        />
      </div>

      {/* Personal info card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-id-card text-[#1e5a48]"></i> Personal Information
          </h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <InfoRow icon="fas fa-phone" label="Phone" value={customer.phone} />
          <InfoRow icon="fas fa-user" label="Father / Husband" value={customer.father_husband_name} />
          <InfoRow icon="fas fa-birthday-cake" label="Date of Birth"
                   value={customer.date_of_birth ? safeFormatDate(customer.date_of_birth, 'dd MMM, yyyy') : null} />
          <InfoRow icon="fas fa-id-badge" label="Aadhaar / VID"
                   value={customer.aadhaar_vid ? `••••••••${customer.aadhaar_vid.slice(-4)}` : null}
                   mono />
          <InfoRow icon="fas fa-credit-card" label="PAN" value={customer.pan_number} mono />
          <InfoRow icon="fas fa-briefcase" label="Occupation" value={customer.occupation} />
          <InfoRow icon="fas fa-rupee-sign" label="Monthly Income"
                   value={customer.monthly_income != null ? formatCurrency(customer.monthly_income) : null} />
          <InfoRow icon="fas fa-user-shield" label="Nominee" value={customer.nominee_name} />
          <div className="md:col-span-2">
            <InfoRow icon="fas fa-map-marker-alt" label="Address" value={customer.address} multiline />
          </div>
          {customer.notes && (
            <div className="md:col-span-2">
              <InfoRow icon="fas fa-sticky-note" label="Notes" value={customer.notes} multiline />
            </div>
          )}
        </div>
      </div>

      {/* EMI Loans list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-list text-[#1e5a48]"></i> EMI Loans ({loans.length})
          </h3>
        </div>
        {loans.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-mobile-alt text-4xl text-gray-300 mb-3"></i>
            <p className="font-medium">No EMI loans yet</p>
            <p className="text-xs text-gray-400 mt-1">This customer has not taken any product EMI from us.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-4 font-medium">Loan Code</th>
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium text-right">Financed</th>
                  <th className="p-4 font-medium text-right">EMI</th>
                  <th className="p-4 font-medium text-right">Outstanding</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Disbursed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...activeLoans, ...closedLoans].map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-xs text-[#1e5a48]">{l.loan_code}</td>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{l.product_name}</p>
                      <p className="text-xs text-gray-500">{l.tenure_months} months</p>
                    </td>
                    <td className="p-4 text-right">{formatCurrency(l.financed_amount)}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(l.emi_amount)}</td>
                    <td className="p-4 text-right font-bold text-[#1e5a48]">{formatCurrency(l.remaining_principal)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                        l.status === 'active'    ? 'bg-green-100 text-green-700' :
                        l.status === 'closed'    ? 'bg-gray-100 text-gray-700' :
                        l.status === 'defaulted' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-gray-600">{safeFormatDate(l.disbursed_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

function KpiCard({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-xl`}>
        <i className={icon}></i>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, mono, multiline }: {
  icon: string;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 mt-0.5">
        <i className={icon}></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono' : ''} ${multiline ? 'whitespace-pre-line' : 'truncate'}`}>
          {value || <span className="text-gray-400 font-normal">—</span>}
        </p>
      </div>
    </div>
  );
}
