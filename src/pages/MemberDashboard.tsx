import React from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { MemberHome } from './MemberHome';

// Placeholder components for Member sections
const MemberTransactions = () => <div className="p-6"><h2 className="text-2xl font-bold mb-4">Transaction History</h2><p>List of past installments.</p></div>;
const MemberLoans = () => <div className="p-6"><h2 className="text-2xl font-bold mb-4">My Loans</h2><p>Active loans and repayment history.</p></div>;
const MemberWithdrawal = () => <div className="p-6"><h2 className="text-2xl font-bold mb-4">Withdrawal Request</h2><p>Early withdrawal or maturity claim form.</p></div>;

export function MemberDashboard() {
  const { logout, memberId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { path: '/member', label: 'Passbook', icon: 'fas fa-book' },
    { path: '/member/transactions', label: 'History', icon: 'fas fa-history' },
    { path: '/member/loans', label: 'Loans', icon: 'fas fa-hand-holding-usd' },
    { path: '/member/withdrawal', label: 'Withdrawal', icon: 'fas fa-money-bill-wave' },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-['Noto_Sans_Bengali',sans-serif]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-gray-100 flex flex-col items-center gap-3">
          <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
          <div className="text-center">
            <h2 className="font-bold text-gray-800">Member Portal</h2>
            <p className="text-xs text-gray-500">ID: {memberId || 'Loading...'}</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.path || (item.path !== '/member' && location.pathname.startsWith(item.path))
                  ? 'bg-[#eef5f0] text-[#1e5a48] font-bold shadow-sm'
                  : 'hover:bg-gray-50 text-gray-600 hover:text-[#1e5a48]'
              }`}
            >
              <i className={`${item.icon} w-5 text-center`}></i>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-4 py-3 w-full rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium border border-transparent hover:border-red-100"
          >
            <i className="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <header className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-0">
          <h1 className="text-xl font-bold text-[#1a4d3c]">Welcome Back!</h1>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-800">Member Name</p>
              <p className="text-xs text-gray-500">Category C</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e5a48] to-[#0b3b2f] rounded-full flex items-center justify-center text-white shadow-md border-2 border-white">
              <i className="fas fa-user"></i>
            </div>
          </div>
        </header>
        <main className="p-8 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<MemberHome />} />
            <Route path="/transactions" element={<MemberTransactions />} />
            <Route path="/loans" element={<MemberLoans />} />
            <Route path="/withdrawal" element={<MemberWithdrawal />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
