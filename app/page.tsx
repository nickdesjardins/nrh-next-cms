import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server'; // Adjust path as needed
import { cookies } from 'next/headers';

const DEFAULT_LOCALE = 'en'; // Your default locale
const LANGUAGE_COOKIE_KEY = 'NEXT_USER_LOCALE'; // Your cookie name

export default async function RootPage() {
  const cookieStore = await cookies();
  const supabase = createClient(); // Server client

  // Determine user's preferred language (e.g., from cookie, then DB default)
  let currentLocale = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value || DEFAULT_LOCALE;

  // Optionally, fetch default language from DB if no cookie
  if (!cookieStore.get(LANGUAGE_COOKIE_KEY)?.value) {
    const { data: langData, error: langError } = await supabase
      .from('languages')
      .select('code')
      .eq('is_default', true)
      .single();
    if (langData && !langError) {
      currentLocale = langData.code;
    }
  }

  // Redirect to the language-specific homepage slug
  if (currentLocale === 'fr') {
    redirect('/accueil');
  } else {
    redirect('/home'); // Default to 'en' or your primary language's home slug
  }

  // This return is effectively unreachable due to redirects but satisfies Next.js
  return null;
}