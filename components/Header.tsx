// components/Header.tsx
import { createClient as createSupabaseServerClient } from '../utils/supabase/server'; // Adjusted path
import Link from 'next/link';
import { getProfileWithRoleServerSide } from '../utils/supabase/server'; // Adjusted path
import type { UserRole, NavigationItem } from '../utils/supabase/types'; // Adjusted path
import HeaderAuth from './header-auth'; // Adjusted path if needed, assuming it's in components/
import LanguageSwitcher from './LanguageSwitcher';
import { getNavigationMenu } from '../app/cms/navigation/actions'; // Adjusted path
import { headers } from 'next/headers';
import ResponsiveNav from './ResponsiveNav'; // Import the new client component

const DEFAULT_LOCALE_FOR_HEADER = 'en';

export default async function Header() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole: UserRole | null = null;
  if (user) {
    const profile = await getProfileWithRoleServerSide(user.id);
    userRole = profile?.role ?? null;
  }

  const canAccessCms = userRole === 'ADMIN' || userRole === 'WRITER';

  const heads = await headers();
  const currentLocale = heads.get('x-user-locale') || DEFAULT_LOCALE_FOR_HEADER;
  let headerNavItems: NavigationItem[] = [];
  try {
    headerNavItems = await getNavigationMenu('HEADER', currentLocale);
  } catch (error) {
    console.error("Error fetching header navigation:", error);
    // Gracefully handle error, e.g. by leaving headerNavItems empty
  }
  
  return (
    <ResponsiveNav
      homeLinkHref="/"
      homeLinkLabel="Home"
      navItems={headerNavItems}
      canAccessCms={canAccessCms}
      cmsDashboardLinkHref="/cms/dashboard"
      cmsDashboardLinkLabel="CMS Dashboard"
      headerAuthComponent={<HeaderAuth />}
      languageSwitcherComponent={<LanguageSwitcher />}
    />
  );
}