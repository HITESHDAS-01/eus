import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/lib/AuthContext';
import { Button, Input, Label } from './ui/basic';

export function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'member' | 'admin'>('member');
  const { loginMember, loginAdmin } = useAuth();
  const navigate = useNavigate();

  // Member Form State
  const [memberCode, setMemberCode] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);

  // Admin Form State
  const [adminPhone, setAdminPhone] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNum1(Math.floor(Math.random() * 10) + 1);
      setNum2(Math.floor(Math.random() * 10) + 1);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError('Incorrect CAPTCHA answer.');
      return;
    }
    setLoading(true);
    const success = await loginMember(memberCode, memberPhone);
    setLoading(false);
    if (success) {
      onClose();
      navigate('/member/dashboard');
    } else {
      setError('Invalid Member ID or Phone Number.');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const allowedPhones = ['8638074383', '7002295480', '7002241938'];
    if (!allowedPhones.includes(adminPhone)) {
      setError('Unauthorized admin phone number.');
      return;
    }

    if (!showOtp) {
      // In a real app, trigger OTP send here
      setShowOtp(true);
      return;
    }

    setLoading(true);
    const success = await loginAdmin(adminPhone, adminOtp);
    setLoading(false);
    if (success) {
      onClose();
      navigate('/admin/dashboard');
    } else {
      setError('Invalid OTP.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-gray-50 py-6 flex flex-col items-center justify-center border-b border-gray-100">
          <img src="https://i.ibb.co/xKRYj0f4/euslogo.png" alt="EUS Logo" className="w-16 h-16 object-contain mb-2" referrerPolicy="no-referrer" />
          <h2 className="text-xl font-bold text-gray-800">একতা উন্নয়ন সংস্থা</h2>
        </div>
        <div className="flex border-b">
          <button
            className={`flex-1 py-4 text-center font-semibold ${activeTab === 'member' ? 'bg-[#1e5a48] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => { setActiveTab('member'); setError(''); }}
          >
            Member Login
          </button>
          <button
            className={`flex-1 py-4 text-center font-semibold ${activeTab === 'admin' ? 'bg-[#1e5a48] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => { setActiveTab('admin'); setError(''); }}
          >
            Admin Login
          </button>
        </div>

        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

          {activeTab === 'member' ? (
            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberCode">Member ID</Label>
                <Input
                  id="memberCode"
                  placeholder="e.g. EUS/012024/C/001"
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberPhone">Mobile Number</Label>
                <Input
                  id="memberPhone"
                  type="tel"
                  pattern="[0-9]{10}"
                  placeholder="10 digit mobile number"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="captcha">What is {num1} + {num2}?</Label>
                <Input
                  id="captcha"
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Logging in...' : 'Login as Member'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminPhone">Admin Mobile Number</Label>
                <Input
                  id="adminPhone"
                  type="tel"
                  pattern="[0-9]{10}"
                  placeholder="10 digit mobile number"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  disabled={showOtp}
                  required
                />
              </div>
              {showOtp && (
                <div className="space-y-2">
                  <Label htmlFor="adminOtp">Enter OTP (Use 123456 for demo)</Label>
                  <Input
                    id="adminOtp"
                    type="text"
                    value={adminOtp}
                    onChange={(e) => setAdminOtp(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Processing...' : showOtp ? 'Verify OTP & Login' : 'Send OTP'}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
