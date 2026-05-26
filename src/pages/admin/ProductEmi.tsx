import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Vendors } from './emi/Vendors';
import { EmiCustomers } from './emi/EmiCustomers';
import { EmiCustomerProfile } from './emi/EmiCustomerProfile';
import { EmiLoans } from './emi/EmiLoans';
import { EmiLoanProfile } from './emi/EmiLoanProfile';
import { EmiDashboard } from './emi/EmiDashboard';

// ---------------------------------------------------------------------------
// Product EMI — parent page for the electronics-finance feature.
//
// Routing (nested under /admin/emi):
//   /                       → tabbed dashboard (Dashboard | Loans | Customers | Vendors)
//   /customers/:id          → full EMI customer profile page
//
// Currently implemented:
//   - Vendors (CRUD)
//   - EMI Customers (CRUD)
//   - EMI Customer Profile (read-only detail page)
// Coming next:
//   - EMI Loans (create, view, record payment, history)
//   - Dashboard (KPIs: disbursed, outstanding, collected, overdue)
// ---------------------------------------------------------------------------

export function ProductEmi() {
  return (
    <Routes>
      <Route path="/" element={<ProductEmiHome />} />
      <Route path="/customers/:id" element={<EmiCustomerProfile />} />
      <Route path="/loans/:id" element={<EmiLoanProfile />} />
    </Routes>
  );
}

type Tab = 'dashboard' | 'loans' | 'customers' | 'vendors';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-pie' },
  { id: 'loans',     label: 'EMI Loans', icon: 'fas fa-mobile-alt' },
  { id: 'customers', label: 'Customers', icon: 'fas fa-user-friends' },
  { id: 'vendors',   label: 'Vendors',   icon: 'fas fa-store' },
];

function ProductEmiHome() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Product EMI</h1>
        <p className="text-sm text-gray-500 mt-1">Finance electronics & consumer products on monthly EMI.</p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-1 whitespace-nowrap">
          {TABS.map(t => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  isActive
                    ? 'border-[#1e5a48] text-[#1e5a48]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <i className={t.icon}></i> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'dashboard' && <EmiDashboard />}
        {activeTab === 'loans'     && <EmiLoans />}
        {activeTab === 'customers' && <EmiCustomers />}
        {activeTab === 'vendors'   && <Vendors />}
      </div>
    </div>
  );
}

