'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import type { User } from './types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Fetch user profile
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (data) {
            setUser(data as User);
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  async function checkAuth() {
    try {
      const { data: authData } = await supabase.auth.getUser();

      if (authData?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (data) {
          setUser(data as User);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Fetch user profile immediately after successful login
    if (data.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError) {
        console.error('Profile fetch error:', userError);
        throw new Error('User profile not found. Contact admin.');
      }

      setUser(userData as User);
    }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role: 'admin',
        status: 'active',
      });

      if (userError) throw userError;
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
