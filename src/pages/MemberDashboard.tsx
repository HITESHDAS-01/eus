import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { MemberHome } from './MemberHome';
import { MemberTransactions } from './MemberTransactions';
import { MemberLoans } from './MemberLoans';
import { translations } from '../lib/lang';

export function MemberDashboard() {
  const { logout, memberId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [lang, setLang] = useState<'as' | 'en'>('as');

  useEffect(() => {
    const savedLang = localStorage.getItem('eus_lang');
    if (savedLang === 'en' || savedLang === 'as') {
      setLang(savedLang);
    }
    
    // Listen for custom event if landing page changes lang while logged in (rare but good practice)
    const handleStorageChange = () => {
      const currentLang = localStorage.getItem('eus_lang');
      if (currentLang === 'en' || currentLang === 'as') {
        setLang(currentLang);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleLang = () => {
    const newLang = lang === 'as' ? 'en' : 'as';
    setLang(newLang);
    localStorage.setItem('eus_lang', newLang);
    window.dispatchEvent(new Event('storage')); // manually trigger for same-window updates
  };

  const t = translations[lang];

  useEffect(() => {
    if (memberId) {
      supabase.from('members').select('*, profiles(full_name, photo_url)').eq('id', memberId).single()
        .then(({ data }) => setMemberProfile(data));
    }
  }, [memberId]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { path: '/member', label: t.sidebar.passbook, icon: 'fas fa-book' },
    { path: '/member/transactions', label: t.sidebar.history, icon: 'fas fa-history' },
    { path: '/member/loans', label: t.sidebar.loans, icon: 'fas fa-hand-holding-usd' },
  ];

  return (
    <div className="flex h-screen bg-[#f4f7f6] font-['Roboto',sans-serif]">
      {/* Material Navigation Drawer */}
      <div 
        className={`${isSidebarOpen ? 'w-72' : 'w-0 lg:w-20'} transition-all duration-300 ease-in-out bg-[#0b3b2f] text-white flex flex-col shadow-2xl z-20 overflow-hidden lg:rounded-r-3xl`}
      >
        <div className="h-16 flex items-center px-4 shrink-0">
          <Link to="/" className="flex items-center" title={t.sidebar.backToSite}>
            <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo" className="w-10 h-10 object-contain bg-white rounded-xl p-1 shadow-sm shrink-0 hover:ring-2 hover:ring-[#f7b05e] transition-all" referrerPolicy="no-referrer" />
            <span className={`ml-3 font-bold text-lg tracking-wide whitespace-nowrap transition-opacity duration-300 hover:text-[#f7b05e] ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              {t.sidebar.title}
            </span>
          </Link>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/member' && location.pathname.startsWith(item.path));
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
            title={!isSidebarOpen ? t.sidebar.backToSite : undefined}
          >
            <i className="fas fa-globe text-lg w-6 text-center shrink-0"></i>
            <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              {t.sidebar.backToSite}
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className={`flex items-center px-4 py-3.5 w-full rounded-full text-red-300 hover:bg-red-500/10 hover:text-red-200 transition-all duration-200 ${!isSidebarOpen && 'justify-center lg:justify-start'}`}
            title={!isSidebarOpen ? t.sidebar.logout : undefined}
          >
            <i className="fas fa-sign-out-alt text-lg w-6 text-center shrink-0"></i>
            <span className={`ml-3 font-medium whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>
              {t.sidebar.logout}
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
            <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block font-['Noto_Sans_Bengali',sans-serif]">{t.header.orgName}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleLang} 
              className="flex items-center gap-1 text-sm font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors mr-2 border border-white/20"
            >
              <i className="fas fa-language"></i> {lang === 'as' ? 'EN' : 'অস'}
            </button>
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-white pr-2">{Array.isArray(memberProfile?.profiles) ? memberProfile.profiles[0]?.full_name : memberProfile?.profiles?.full_name || 'Member User'}</p>
                <p className="text-xs text-gray-300 pr-2">{t.header.category} {memberProfile?.category || '-'}</p>
              </div>
              <div className="w-10 h-10 bg-[#1a5f4a] rounded-full flex items-center justify-center text-[#f7b05e] shadow-md cursor-pointer hover:shadow-lg transition-shadow overflow-hidden">
                {(() => {
                  const profile = Array.isArray(memberProfile?.profiles) ? memberProfile.profiles[0] : memberProfile?.profiles;
                  if (profile?.photo_url) {
                    return <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />;
                  }
                  return <i className="fas fa-user"></i>;
                })()}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<MemberHome />} />
              <Route path="/transactions" element={<MemberTransactions />} />
              <Route path="/loans" element={<MemberLoans />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
