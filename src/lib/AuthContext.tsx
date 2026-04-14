import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

type UserRole = 'admin' | 'member' | null;

interface AuthContextType {
  user: any | null;
  role: UserRole;
  memberId: string | null;
  loading: boolean;
  loginAdmin: (phone: string, otp: string) => Promise<boolean>;
  loginMember: (memberCode: string, phone: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for mock session first
    const mockSession = localStorage.getItem('mockSession');
    if (mockSession) {
      const data = JSON.parse(mockSession);
      setUser({ id: data.id, phone: data.phone });
      setRole(data.role);
      setMemberId(data.memberId || null);
      setLoading(false);
      return;
    }

    // Check Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserRole(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setMemberId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (profile) {
        setRole(profile.role as UserRole);
        if (profile.role === 'member') {
          const { data: member } = await supabase
            .from('members')
            .select('id')
            .eq('id', userId)
            .single();
          if (member) setMemberId(member.id);
        }
      }
    } catch (error) {
      console.error('Error fetching role:', error);
    } finally {
      setLoading(false);
    }
  };

  const loginAdmin = async (phone: string, otp: string) => {
    if (otp === '123456') {
      // Mock login for demo
      const mockData = { id: 'admin-1', phone, role: 'admin' };
      localStorage.setItem('mockSession', JSON.stringify(mockData));
      setUser({ id: mockData.id, phone });
      setRole('admin');
      return true;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    }
  };

  const loginMember = async (memberCode: string, phone: string) => {
    // For demo, we'll use a mock login if Supabase is not configured
    try {
      const { data: member, error } = await supabase
        .from('members')
        .select('id, profiles!inner(phone)')
        .eq('member_code', memberCode)
        .eq('profiles.phone', phone)
        .single();

      if (member) {
        // Real login logic would go here, but for now we mock the session
        // since we don't have a password for members
        const mockData = { id: member.id, phone, role: 'member', memberId: member.id };
        localStorage.setItem('mockSession', JSON.stringify(mockData));
        setUser({ id: mockData.id, phone });
        setRole('member');
        setMemberId(member.id);
        return true;
      }
    } catch (error) {
      console.error('Member login error:', error);
    }

    // Fallback mock login for demo if no DB connection
    if (memberCode.startsWith('EUS/')) {
      const mockData = { id: 'member-1', phone, role: 'member', memberId: 'member-1' };
      localStorage.setItem('mockSession', JSON.stringify(mockData));
      setUser({ id: mockData.id, phone });
      setRole('member');
      setMemberId('member-1');
      return true;
    }

    return false;
  };

  const logout = async () => {
    localStorage.removeItem('mockSession');
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setMemberId(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, memberId, loading, loginAdmin, loginMember, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
