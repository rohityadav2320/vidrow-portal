import { supabase } from './supabase';
import type { User } from './types';

export const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'creator' | 'editor') => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (authData.user) {
      // Create user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          role,
          full_name: fullName,
          status: 'active',
        })
        .select()
        .single();

      if (profileError) throw profileError;

      return { user: profileData, error: null };
    }

    return { user: null, error: 'No user returned' };
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;

    // Fetch user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError) throw userError;

    return { user: userData as User, error: null };
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { user: null, error: authError?.message || 'Not authenticated' };
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError) {
      return { user: null, error: userError.message };
    }

    return { user: userData as User, error: null };
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const resetPassword = async (email: string) => {
  return await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });
};

export const updatePassword = async (newPassword: string) => {
  return await supabase.auth.updateUser({ password: newPassword });
};
