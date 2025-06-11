// context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient as createSupabaseBrowserClient, getProfileWithRoleClientSide } from '@/utils/supabase/client';
import { Profile, UserRole } from '@/utils/supabase/types';

interface AuthProviderProps {
  children: ReactNode;
  serverUser: User | null;
  serverProfile: Profile | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean; 
  isAdmin: boolean;
  isWriter: boolean;
  isUserRole: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children, serverUser, serverProfile }: AuthProviderProps) => {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  
  const [user, setUser] = useState<User | null>(serverUser);
  const [profile, setProfile] = useState<Profile | null>(serverProfile);
  const [role, setRole] = useState<UserRole | null>(serverProfile?.role ?? null);
  const [isLoading, setIsLoading] = useState(false); 

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // When auth state changes on the client (e.g. logout),
          // we may need to re-fetch profile info if a new user signs in.
          // For a simple logout, this will just result in clearing the profile.
          try {
            const userProfileData = await getProfileWithRoleClientSide(supabase, currentUser.id);
            if (isMounted) {
              setProfile(userProfileData);
              setRole(userProfileData?.role ?? null);
            }
          } catch (e) {
            console.error("AuthProvider: Error fetching profile on auth change", e);
            if (isMounted) {
              setProfile(null); setRole(null);
            }
          }
        } else {
          // No user on this event (e.g., SIGNED_OUT), clear profile and role.
          if (isMounted) {
            setProfile(null); setRole(null);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      if (authListener) authListener.unsubscribe();
    };
  }, [supabase]);

  const isAdmin = role === 'ADMIN';
  const isWriter = role === 'WRITER';
  const isUserRole = role === 'USER';

  const contextValue = React.useMemo(() => ({
    user,
    profile,
    role,
    isLoading,
    isAdmin,
    isWriter,
    isUserRole
  }), [user, profile, role, isLoading, isAdmin, isWriter, isUserRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};