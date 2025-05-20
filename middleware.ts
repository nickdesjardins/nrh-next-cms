// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Profile, UserRole } from '@/utils/supabase/types';

const LANGUAGE_COOKIE_KEY = 'NEXT_USER_LOCALE';
const DEFAULT_LOCALE = 'en';
const SUPPORTED_LOCALES = ['en', 'fr']; // Keep this in sync with DB or make dynamic

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
  const requestHeaders = new Headers(request.headers);
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  await supabase.auth.getSession();

  const cookieLocale = request.cookies.get(LANGUAGE_COOKIE_KEY)?.value;
  let currentLocale = cookieLocale;

  if (!currentLocale || !SUPPORTED_LOCALES.includes(currentLocale)) {
    currentLocale = DEFAULT_LOCALE;
  }

  requestHeaders.set('X-User-Locale', currentLocale!);

  const { data: { session } } = await supabase.auth.getSession();
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

  // If response is already a redirect (e.g., from CMS auth checks), return it.
  if (response.headers.get('location')) {
      return response;
  }

  // Otherwise, create a new response that includes the modified request headers (like X-User-Locale).
  // Also, ensure any cookies set by Supabase (on the original `response` object) are carried over.
  const finalResponse = NextResponse.next({
    request: {
      headers: requestHeaders, // These headers include X-User-Locale
    },
  });

  // Transfer cookies from the potentially modified `response` (by Supabase) to `finalResponse`
  response.cookies.getAll().forEach(cookie => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  
  // Ensure our language cookie is also on the outgoing finalResponse if it changed or wasn't set.
  if (request.cookies.get(LANGUAGE_COOKIE_KEY)?.value !== currentLocale) {
      finalResponse.cookies.set(LANGUAGE_COOKIE_KEY, currentLocale!, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }

  return finalResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|auth/.*|sign-in|sign-up|forgot-password|unauthorized|api/auth/.*).*)',
    '/cms/:path*',
  ],
};
