// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Profile, UserRole } from '@/utils/supabase/types';

const LANGUAGE_COOKIE_KEY = 'NEXT_USER_LOCALE'; // Must match LanguageProvider
const DEFAULT_LOCALE = 'en'; // Hardcoded default for middleware simplicity
// In a more advanced setup, you might fetch/cache supported locales here
const SUPPORTED_LOCALES = ['en', 'fr']; // Keep this in sync with DB or make dynamic

// CMS Route Permissions (from Phase 1)
const cmsRoutePermissions: Record<string, UserRole[]> = {
  '/cms': ['WRITER', 'ADMIN'],
  '/cms/admin': ['ADMIN'],
  '/cms/users': ['ADMIN'],
  '/cms/settings': ['ADMIN'],
};

function getRequiredRolesForPath(pathname: string): UserRole[] | null {
    const sortedPaths = Object.keys(cmsRoutePermissions).sort((a, b) => b.length - a.length);
    for (const specificPath of sortedPaths) {
      if (pathname === specificPath || pathname.startsWith(specificPath + (specificPath === '/' ? '' : '/'))) {
          return cmsRoutePermissions[specificPath];
      }
    }
    return null;
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers); // Clone request headers
  let response = NextResponse.next({
    request: {
      headers: requestHeaders, // Use the cloned headers
    },
  });

  // Supabase client for auth session refresh & role check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options }); // Apply to request cookies for chaining
          response = NextResponse.next({ request: { headers: requestHeaders } }); // Recreate response with updated headers
          response.cookies.set({ name, value, ...options }); // Apply to response cookies
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getSession(); // Refresh Supabase session

  // ** Language Handling **
  let currentLocale = request.cookies.get(LANGUAGE_COOKIE_KEY)?.value;

  if (!currentLocale || !SUPPORTED_LOCALES.includes(currentLocale)) {
    // TODO: Add Accept-Language header parsing here for better default
    // For now, simple default if cookie is invalid or not set
    currentLocale = DEFAULT_LOCALE;
  }

  // Set custom header for Server Components to read the locale
  requestHeaders.set('X-User-Locale', currentLocale);

  // Ensure the cookie is set in the browser for subsequent requests and client-side JS
  // Note: response.cookies.set can be problematic if `NextResponse.next` was already used to create `response`
  // without passing the modified request.headers. It's safer to set it on a fresh response if needed or
  // ensure the response object is consistently managed.
  // The Supabase client's cookie handling in `set` above should manage `response` updates.
  // Here we ensure our language cookie is also on the outgoing response.
  if (request.cookies.get(LANGUAGE_COOKIE_KEY)?.value !== currentLocale) {
      response.cookies.set(LANGUAGE_COOKIE_KEY, currentLocale, { path: '/', maxAge: 31536000, sameSite: 'lax' }); // 1 year
  }


  // ** Auth and CMS Route Protection (from Phase 1, adapted to use updated requestHeaders) **
  const { data: { session } } = await supabase.auth.getSession(); // Use getSession to get session object
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/cms')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/sign-in?redirect=${pathname}`, request.url));
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single<Pick<Profile, 'role'>>();

    if (profileError || !profile) {
      console.error(`Middleware: Profile error for user ${session.user.id} accessing ${pathname}`, profileError?.message);
      return NextResponse.redirect(new URL('/unauthorized?error=profile_issue', request.url));
    }

    const userRole = profile.role as UserRole;
    const requiredRoles = getRequiredRolesForPath(pathname);

    if (requiredRoles && !requiredRoles.includes(userRole)) {
      console.warn(`Middleware: User ${session.user.id} (Role: ${userRole}) denied access to ${pathname}. Required: ${requiredRoles.join(' OR ')}`);
      return NextResponse.redirect(new URL(`/unauthorized?path=${pathname}&required=${requiredRoles.join(',')}`, request.url));
    }
  }

  // Return the potentially modified response (with new cookies and using potentially new request headers for NextResponse.next)
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/.*|sign-in|sign-up|forgot-password|unauthorized|api/auth/.*).*)',
    '/cms/:path*',
  ],
};