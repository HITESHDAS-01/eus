import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

type UserRole = 'admin' | 'member' | null;

interface AuthContextType {
  user: any | null;
  role: UserRole;
  memberId: string | null;
  loading: boolean;
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  loginMember: (memberCode: string) => Promise<boolean>;
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

  const loginAdmin = async (email: string, password: string) => {
    // Mock login for demo
    if (email === 'admin@eus.com' && password === 'admin123') {
      const mockData = { id: 'admin-1', email, role: 'admin' };
      localStorage.setItem('mockSession', JSON.stringify(mockData));
      setUser({ id: mockData.id, email });
      setRole('admin');
      return true;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      // Check if the user is actually an admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
        
      if (profile?.role === 'admin') {
        setUser(data.user);
        setRole('admin');
        return true;
      } else {
        // If not admin, sign out
        await supabase.auth.signOut();
        return false;
      }
    } catch (error) {
      console.error('Admin login error:', error);
      return false;
    }
  };

  const loginMember = async (memberCode: string) => {
    try {
      const { data: member, error } = await supabase
        .from('members')
        .select('id, member_code')
        .eq('member_code', memberCode)
        .single();

      if (member) {
        const mockData = { id: member.id, memberCode, role: 'member', memberId: member.id };
        localStorage.setItem('mockSession', JSON.stringify(mockData));
        setUser({ id: mockData.id, memberCode });
        setRole('member');
        setMemberId(member.id);
        return true;
      }
    } catch (error) {
      console.error('Member login error:', error);
    }

    // Fallback mock login for demo if no DB connection
    if (memberCode.startsWith('EUS/')) {
      const mockData = { id: 'member-1', memberCode, role: 'member', memberId: 'member-1' };
      localStorage.setItem('mockSession', JSON.stringify(mockData));
      setUser({ id: mockData.id, memberCode });
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
