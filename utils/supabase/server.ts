// utils/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { Profile, Language } from './types'; // Import custom types

// This is the standard server client creation function from the Vercel example
export const createClient = () => {
  const cookieStorePromise = (cookies() as unknown as UnsafeUnwrappedCookies);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookieStore = await cookieStorePromise;
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            (async () => {
              const cookieStore = await cookieStorePromise;
              cookieStore.set({ name, value, ...options });
            })();
          } catch (error) {
            // The `set` method was called from a Server Component.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            (async () => {
              const cookieStore = await cookieStorePromise;
              cookieStore.set({ name, value: '', ...options });
            })();
          } catch (error) {
            // The `delete` method was called from a Server Component.
          }
        },
      },
    }
  );
};

// Helper function to get profile with role (server-side)
export async function getProfileWithRoleServerSide(userId: string): Promise<Profile | null> {
  const supabase = createClient(); // Uses the server client defined above
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*') // Select all fields including role
    .eq('id', userId)
    .single();

  if (profileError || !profileData) {
    // Avoid logging full error in production if it contains sensitive info,
    // but log message for debugging.
    console.error('Error fetching profile (server-side):', profileError?.message);
    return null;
  }
  return profileData as Profile;
}

export async function getActiveLanguagesServerSide(): Promise<Language[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('languages')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching languages (server-side):', error.message);
    return [];
  }
  return data || [];
}