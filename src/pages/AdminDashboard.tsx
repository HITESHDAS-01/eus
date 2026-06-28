import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { branding } from '../config/branding';
import { AdminHome } from './AdminHome';
import { Members } from './admin/Members';
import { Transactions } from './admin/Transactions';
import { Loans } from './admin/Loans';
import { Settings } from './admin/Settings';
import { Reports } from './admin/Reports';
import { Expenses } from './admin/Expenses';
import { MemberProfile } from './admin/MemberProfile';
import { Investments } from './admin/Investments';
import { ProductEmi } from './admin/ProductEmi';

export function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Default closed on mobile (< 1024px), open on desktop. The user can
  // still toggle, but they shouldn't open the app to a sidebar covering
  // the whole phone screen.
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });

  // Auto-close the sidebar on route change on mobile so it doesn't linger
  // over the new page.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: 'fas fa-home' },
    { path: '/admin/members', label: 'Members', icon: 'fas fa-users' },
    { path: '/admin/transactions', label: 'Transactions', icon: 'fas fa-rupee-sign' },
    { path: '/admin/loans', label: 'Loans', icon: 'fas fa-hand-holding-usd' },
    { path: '/admin/investments', label: 'Investments', icon: 'fas fa-chart-line' },
    { path: '/admin/emi', label: 'Product EMI', icon: 'fas fa-mobile-alt' },
    { path: '/admin/reports', label: 'Reports', icon: 'fas fa-chart-bar' },
    { path: '/admin/expenses', label: 'Expenses', icon: 'fas fa-receipt' },
    { path: '/admin/settings', label: 'Settings', icon: 'fas fa-cog' },
  ];

  return (
    <div className="flex h-screen bg-[#f4f7f6] font-['Roboto',sans-serif] relative">
      {/* Mobile backdrop: tap to close the sidebar */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-10"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Navigation drawer — overlay on mobile, push on desktop */}
      <div
        className={`fixed lg:static top-0 left-0 h-full z-20 transition-all duration-300 ease-in-out bg-[#0b3b2f] text-white flex flex-col shadow-2xl overflow-hidden lg:rounded-r-3xl ${
          isSidebarOpen ? 'w-72' : 'w-0 lg:w-20'
        }`}
      >
        <div className="h-16 flex items-center px-4 shrink-0">
          <Link to="/" className="flex items-center" title="Back to Site">
            <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt={`${branding.orgShort} Logo`} className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-sm shrink-0 hover:ring-2 hover:ring-[#f7b05e] transition-all" referrerPolicy="no-referrer" />
            <span className={`ml-3 font-bold text-lg tracking-wide whitespace-nowrap transition-opacity duration-300 hover:text-[#f7b05e] ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              Admin Panel
            </span>
          </Link>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3.5 rounded-full transition-all duration-200 group ${
                  isActive
                    ? 'bg-[#1a5f4a] text-[#f7b05e] shadow-md'
                    : 'hover:bg-white/10 text-gray-300 hover:text-white'
                }`}
                title={!isSidebarOpen ? item.label : undefined}
              >
                <i className={`${item.icon} text-lg w-6 text-center shrink-0 ${isActive ? 'text-[#f7b05e]' : 'text-gray-400 group-hover:text-white'}`}></i>
                <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-3 shrink-0 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className={`flex items-center px-4 py-3.5 w-full rounded-full text-[#f7b05e] hover:bg-[#f7b05e]/10 transition-all duration-200 ${!isSidebarOpen && 'justify-center lg:justify-start'}`}
            title={!isSidebarOpen ? 'Back to Site' : undefined}
          >
            <i className="fas fa-globe text-lg w-6 text-center shrink-0"></i>
            <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              Back to Site
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className={`flex items-center px-4 py-3.5 w-full rounded-full text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all duration-200 ${!isSidebarOpen && 'justify-center lg:justify-start'}`}
            title={!isSidebarOpen ? 'Logout' : undefined}
          >
            <i className="fas fa-sign-out-alt text-lg w-6 text-center shrink-0"></i>
            <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              Logout
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Material Top App Bar */}
        <header className="h-16 bg-[#0b3b2f] text-white shadow-md z-10 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-colors focus:ring-2 focus:ring-[#f7b05e] focus:outline-none"
            >
              <i className="fas fa-bars text-lg"></i>
            </button>
            <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block font-['Noto_Sans_Bengali',sans-serif]">{branding.orgNameNative}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-white">Admin User</p>
                <p className="text-xs text-gray-300">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-[#1a5f4a] rounded-full flex items-center justify-center text-[#f7b05e] shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                <i className="fas fa-user-shield"></i>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<AdminHome />} />
              <Route path="/members/:id" element={<MemberProfile />} />
              <Route path="/members/*" element={<Members />} />
              <Route path="/transactions/*" element={<Transactions />} />
              <Route path="/loans/*" element={<Loans />} />
              <Route path="/investments/*" element={<Investments />} />
              <Route path="/emi/*" element={<ProductEmi />} />
              <Route path="/reports/*" element={<Reports />} />
              <Route path="/expenses/*" element={<Expenses />} />
              <Route path="/settings/*" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
