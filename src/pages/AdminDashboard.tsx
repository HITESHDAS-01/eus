import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { AdminHome } from './AdminHome';
import { Members } from './admin/Members';
import { Transactions } from './admin/Transactions';
import { Loans } from './admin/Loans';
import { Settings } from './admin/Settings';
import { Reports } from './admin/Reports';

export function AdminDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: 'fas fa-home' },
    { path: '/admin/members', label: 'Members', icon: 'fas fa-users' },
    { path: '/admin/transactions', label: 'Transactions', icon: 'fas fa-rupee-sign' },
    { path: '/admin/loans', label: 'Loans', icon: 'fas fa-hand-holding-usd' },
    { path: '/admin/reports', label: 'Reports', icon: 'fas fa-chart-bar' },
    { path: '/admin/settings', label: 'Settings', icon: 'fas fa-cog' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-['Noto_Sans_Bengali',sans-serif]">
      {/* Sidebar */}
      <div className="w-64 bg-[#0b3b2f] text-white flex flex-col">
        <div className="p-4 border-b border-[#1a5f4a] flex items-center gap-3">
          <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo" className="w-10 h-10 object-contain bg-white rounded-lg p-1" referrerPolicy="no-referrer" />
          <span className="font-bold text-lg">Admin Panel</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path))
                  ? 'bg-[#1a5f4a] text-[#f7b05e]'
                  : 'hover:bg-[#1a5f4a] text-gray-300 hover:text-white'
              }`}
            >
              <i className={`${item.icon} w-5 text-center`}></i>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[#1a5f4a]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-red-900/30 transition-colors"
          >
            <i className="fas fa-sign-out-alt w-5 text-center"></i>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Ekata Unnayan Sanstha</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">Admin User</span>
            <div className="w-8 h-8 bg-[#1e5a48] rounded-full flex items-center justify-center text-white">
              <i className="fas fa-user"></i>
            </div>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<AdminHome />} />
            <Route path="/members/*" element={<Members />} />
            <Route path="/transactions/*" element={<Transactions />} />
            <Route path="/loans/*" element={<Loans />} />
            <Route path="/reports/*" element={<Reports />} />
            <Route path="/settings/*" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
