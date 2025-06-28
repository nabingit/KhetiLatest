import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthContextType } from '../types';
import { supabase, handleSupabaseError } from '../lib/supabase';
import type { AuthError } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Handle case where profile doesn't exist
        if (error.code === 'PGRST116') {
          console.error('Profile not found for user:', userId);
          // Don't set user to null here, let the login function handle this
          setLoading(false);
          return;
        }
        throw error;
      }

      if (data) {
        const userProfile: User = {
          id: data.id,
          name: data.name,
          email: '', // Will be set from auth
          contactNumber: data.contact_number,
          userType: data.user_type,
          location: data.location || undefined,
          dateOfBirth: data.date_of_birth || undefined,
          weight: data.weight || undefined,
          height: data.height || undefined,
          profilePicture: data.profile_picture || undefined,
          workingPicture: data.working_picture || undefined,
          createdAt: data.created_at
        };

        // Get email from auth user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.email) {
          userProfile.email = authUser.email;
        }

        setUser(userProfile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Don't set user to null on error, let the login function handle this
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const validateContactNumber = (contactNumber: string): boolean => {
    // Remove all non-digit characters
    const cleanNumber = contactNumber.replace(/\D/g, '');
    
    // Check if it's a valid Indian mobile number (10 digits starting with 6-9)
    const indianMobileRegex = /^[6-9]\d{9}$/;
    return indianMobileRegex.test(cleanNumber);
  };

  const signup = async (
    name: string, 
    email: string, 
    password: string, 
    contactNumber: string,
    userType: 'farmer' | 'worker',
    location?: string,
    dateOfBirth?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate contact number
      if (!validateContactNumber(contactNumber)) {
        return { success: false, error: 'Please enter a valid 10-digit mobile number' };
      }

      // Validate age for workers
      if (userType === 'worker' && dateOfBirth) {
        const age = calculateAge(dateOfBirth);
        if (age < 16) {
          return { success: false, error: 'Workers must be at least 16 years old to register' };
        }
      }

      // Sign up with Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            contact_number: contactNumber.replace(/\D/g, ''),
            user_type: userType,
            location: userType === 'worker' ? location : undefined,
            date_of_birth: userType === 'worker' ? dateOfBirth : undefined
          }
        }
      });

      if (authError) {
        return { success: false, error: handleSupabaseError(authError) };
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name,
            contact_number: contactNumber.replace(/\D/g, ''),
            user_type: userType,
            location: userType === 'worker' ? location || null : null,
            date_of_birth: userType === 'worker' ? dateOfBirth || null : null
          });

        if (profileError) {
          return { success: false, error: handleSupabaseError(profileError) };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: handleSupabaseError(error) };
    }
  };

  const testConnection = async () => {
    try {
      console.log('Testing Supabase connection...');
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      if (error) {
        console.error('Connection test failed:', error);
        return false;
      }
      console.log('Connection test successful');
      return true;
    } catch (error) {
      console.error('Connection test error:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; profileExists?: boolean }> => {
    try {
      console.log('Attempting login for email:', email);
      
      // Test connection first
      const connectionOk = await testConnection();
      if (!connectionOk) {
        return { success: false, error: 'Unable to connect to the server. Please check your internet connection.' };
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Login error:', error);
        return { success: false, error: handleSupabaseError(error) };
      }

      if (data.user) {
        console.log('Auth successful, checking profile for user:', data.user.id);
        // Check if profile exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist
          console.error('Profile not found for user:', data.user.id);
          return { success: false, error: 'Profile not found. Please contact support.', profileExists: false };
        }

        if (profileError) {
          console.error('Profile check error:', profileError);
          return { success: false, error: 'Error checking profile. Please try again.' };
        }

        console.log('Profile found, login successful');
        return { success: true, profileExists: true };
      }
      
      console.log('No user data returned from auth');
      return { success: false, error: 'Login failed. Please try again.' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;

    const updateProfile = async () => {
      try {
        const updateData: any = {};
        
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.contactNumber !== undefined) updateData.contact_number = updates.contactNumber;
        if (updates.location !== undefined) updateData.location = updates.location;
        if (updates.weight !== undefined) updateData.weight = updates.weight;
        if (updates.height !== undefined) updateData.height = updates.height;
        if (updates.profilePicture !== undefined) updateData.profile_picture = updates.profilePicture;
        if (updates.workingPicture !== undefined) updateData.working_picture = updates.workingPicture;

        const { error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id);

        if (error) throw error;

        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
      } catch (error) {
        console.error('Error updating profile:', error);
      }
    };

    updateProfile();
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
  };

  const getUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          name: data.name,
          email: '', // Email not stored in profiles
          contactNumber: data.contact_number,
          userType: data.user_type,
          location: data.location || undefined,
          dateOfBirth: data.date_of_birth || undefined,
          weight: data.weight || undefined,
          height: data.height || undefined,
          profilePicture: data.profile_picture || undefined,
          workingPicture: data.working_picture || undefined,
          createdAt: data.created_at
        };
      }
    } catch (error) {
      console.error('Error getting user profile:', error);
    }
    return null;
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading, updateUser, getUserProfile, testConnection }}>
      {children}
    </AuthContext.Provider>
  );
}