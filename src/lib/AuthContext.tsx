import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { memberAuth } from '../config/branding';

type UserRole = 'admin' | 'member' | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  memberId: string | null;
  loading: boolean;
  loginAdmin: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginMember: (memberCode: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function syntheticMemberEmail(memberCode: string): string {
  const sanitized = memberCode.trim().replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
  return `${sanitized}@${memberAuth.emailDomain}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      if (cancelled) return;
      if (!session?.user) {
        setUser(null);
        setRole(null);
        setMemberId(null);
        setLoading(false);
        return;
      }
      setUser(session.user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (cancelled) return;
      const nextRole = (profile?.role as UserRole) ?? null;
      setRole(nextRole);
      setMemberId(nextRole === 'member' ? session.user.id : null);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: error?.message ?? 'Login failed' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      return { ok: false, error: 'This account does not have admin access.' };
    }
    return { ok: true };
  };

  const loginMember = async (memberCode: string, password: string) => {
    const email = syntheticMemberEmail(memberCode);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { ok: false, error: 'Invalid Member ID or password.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profile?.role !== 'member') {
      await supabase.auth.signOut();
      return { ok: false, error: 'This account is not a member account.' };
    }
    return { ok: true };
  };

  const logout = async () => {
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
