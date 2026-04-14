import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'member' | 'admin'>('member');
  const { loginMember, loginAdmin } = useAuth();
  const navigate = useNavigate();

  // Member Form State
  const [memberCode, setMemberCode] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);

  // Admin Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
    setCaptchaAnswer('');
  };

  useEffect(() => {
    if (isOpen) {
      generateCaptcha();
      setError('');
      setMemberCode('');
      setEmail('');
      setPassword('');
      setActiveTab('member');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError('Incorrect Math Captcha answer.');
      generateCaptcha();
      return;
    }
    if (!memberCode.trim()) {
      setError('Please enter your Member ID.');
      return;
    }
    setLoading(true);
    const success = await loginMember(memberCode);
    setLoading(false);
    if (success) {
      onClose();
      navigate('/member');
    } else {
      setError('Invalid Member ID.');
      generateCaptcha();
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    const success = await loginAdmin(email, password);
    setLoading(false);
    if (success) {
      onClose();
      navigate('/admin');
    } else {
      setError('Invalid email or password.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-[450px] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[#1e5a48] p-6 text-center relative border-b border-[#1a4d3c]">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            >
              <i className="fas fa-times text-xl"></i>
            </button>
            <h2 className="text-2xl font-bold text-white mb-1">একতা উন্নয়ন সংস্থা</h2>
            <p className="text-[#f7b05e] font-medium">Login to your account</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-[#1e5a48]">
            <button
              className={`flex-1 py-4 text-center font-bold transition-colors ${
                activeTab === 'member' 
                  ? 'text-[#f7b05e] border-b-2 border-[#f7b05e] bg-[#1a4d3c]' 
                  : 'text-white/70 hover:text-white hover:bg-[#1a4d3c]/50'
              }`}
              onClick={() => { setActiveTab('member'); setError(''); }}
            >
              Member Login
            </button>
            <button
              className={`flex-1 py-4 text-center font-bold transition-colors ${
                activeTab === 'admin' 
                  ? 'text-[#f7b05e] border-b-2 border-[#f7b05e] bg-[#1a4d3c]' 
                  : 'text-white/70 hover:text-white hover:bg-[#1a4d3c]/50'
              }`}
              onClick={() => { setActiveTab('admin'); setError(''); }}
            >
              Admin Login
            </button>
          </div>

          {/* Body */}
          <div className="p-6 bg-gradient-to-b from-[#0b3b2f] to-[#1a5f4a]">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 text-red-200 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {activeTab === 'member' ? (
              <form onSubmit={handleMemberSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1">Member ID</label>
                  <input
                    type="text"
                    value={memberCode}
                    onChange={(e) => setMemberCode(e.target.value)}
                    placeholder="EUS/032026/C/001"
                    className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#f7b05e] focus:border-transparent transition-shadow"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1">Math Captcha</label>
                  <div className="flex gap-3">
                    <div className="bg-white/10 px-4 py-3 rounded-lg border border-gray-600 font-mono text-lg font-bold text-white flex items-center justify-center min-w-[100px]">
                      {num1} + {num2}
                    </div>
                    <input
                      type="number"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Answer"
                      className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#f7b05e] focus:border-transparent transition-shadow"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#f7b05e] hover:bg-[#e09d3e] text-[#0b3b2f] font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4 shadow-lg"
                >
                  {loading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-sign-in-alt"></i>
                  )}
                  Login as Member
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#f7b05e] focus:border-transparent transition-shadow"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-white/90 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-lg border border-gray-600 bg-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#f7b05e] focus:border-transparent transition-shadow"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#f7b05e] hover:bg-[#e09d3e] text-[#0b3b2f] font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4 shadow-lg"
                >
                  {loading ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fas fa-user-shield"></i>
                  )}
                  Login as Admin
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
