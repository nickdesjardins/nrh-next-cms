// app/layout.tsx
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CurrentContentProvider } from "@/context/CurrentContentContext"; // Import CurrentContentProvider
import { PageTransitionProvider } from '@/components/transitions/PageTransitionProvider'; // Import PageTransitionProvider
import { ClientOnlyTransitionOrchestrator } from '@/components/transitions/ClientOnlyTransitionOrchestrator'; // Import the new orchestrator
import { getActiveLanguagesServerSide } from "@/utils/supabase/server"; // Import server-side language fetcher
// const DynamicTransitionWrapper = dynamic(() =>
//   import('@/components/transitions').then((mod) => mod.TransitionWrapper),
//   { ssr: false }
// ); // Moved into DynamicPageTransitionWrapper
import type { Language } from "@/utils/supabase/types"; // Import Language type

// const DynamicPageTransitionWrapperClient = dynamic(() =>
//   import('@/components/transitions/DynamicPageTransitionWrapper').then((mod) => mod.DynamicPageTransitionWrapper),
//   { ssr: false }
// ); // This dynamic import is now handled within ClientOnlyTransitionOrchestrator

import "./globals.css";
import Header from "@/components/Header";
import FooterNavigation from "@/components/FooterNavigation";
import { headers, cookies } from 'next/headers';
import { unstable_noStore } from 'next/cache'; // For testing

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const DEFAULT_LOCALE_FOR_LAYOUT = 'en';

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'My Ultra-Fast CMS',
  description: 'A block-based TypeScript CMS with Next.js and Supabase',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  unstable_noStore(); // Add this for testing to ensure layout is fully dynamic

  const headerList = await headers();
  const cookieStore = await cookies(); // Await cookies()

  const xUserLocaleHeader = headerList.get('x-user-locale');
  const nextUserLocaleCookie = cookieStore.get('NEXT_USER_LOCALE')?.value;

  let serverDeterminedLocale: string; // Explicitly type serverDeterminedLocale
  if (xUserLocaleHeader) {
    serverDeterminedLocale = xUserLocaleHeader;
  } else {
    if (nextUserLocaleCookie) {
      serverDeterminedLocale = nextUserLocaleCookie;
    } else {
      serverDeterminedLocale = DEFAULT_LOCALE_FOR_LAYOUT;
    }
  }

  // Fetch languages server-side
  let availableLanguages: Language[] = [];
  let defaultLanguage: Language | null = null;

  try {
    availableLanguages = await getActiveLanguagesServerSide();
    defaultLanguage = availableLanguages.find(lang => lang.is_default) || availableLanguages[0] || null;
    // Ensure serverDeterminedLocale is valid, fallback to default if not
    if (!availableLanguages.some(lang => lang.code === serverDeterminedLocale) && defaultLanguage) {
      serverDeterminedLocale = defaultLanguage.code;
    } else if (!availableLanguages.some(lang => lang.code === serverDeterminedLocale)) {
      // If still no valid locale (e.g. no languages in DB), keep layout default
      serverDeterminedLocale = DEFAULT_LOCALE_FOR_LAYOUT;
    }
  } catch (error) {
    console.error("RootLayout: Error fetching languages server-side", error);
    // Fallback to default locale if languages can't be fetched
    serverDeterminedLocale = DEFAULT_LOCALE_FOR_LAYOUT;
  }


  return (
    <html lang={serverDeterminedLocale} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style id="critical-css" dangerouslySetInnerHTML={{ __html: ":root{--background:40 33% 98%;--foreground:210 10% 15%;--border:210 17% 91%;--primary:120 17% 34%;--radius:0.5rem}html{font-family:system-ui,-apple-system,BlinkMacSystemFont,\\\"Segoe UI\\\",Roboto,\\\"Helvetica Neue\\\",Arial,\\\"Noto Sans\\\",sans-serif,\\\"Apple Color Emoji\\\",\\\"Segoe UI Emoji\\\",\\\"Segoe UI Symbol\\\",\\\"Noto Color Emoji\\\";box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;line-height:1.5}*,*::before,*::after{box-sizing:inherit;border-width:0;border-style:solid;border-color:hsl(var(--border))}body{margin:0;background-color:hsl(var(--background));color:hsl(var(--foreground));min-height:100vh}main{display:flex;flex-direction:column;align-items:center;width:100%;min-height:100vh}main>div:first-of-type{flex:1 1 0%;width:100%;display:flex;flex-direction:column;align-items:center}nav{width:100%;display:flex;justify-content:center;border-bottom-width:1px;border-bottom-color:hsla(var(--foreground),.1);height:4rem}nav>div:first-of-type{width:100%;max-width:80rem;display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.25rem;font-size:.875rem;line-height:1.25rem}nav>div:first-of-type>div{display:flex;justify-content:space-between;align-items:center;width:100%}nav>div:first-of-type>div>div:first-child>div{display:none;align-items:baseline;font-weight:600;margin-left:1.5rem}nav>div:first-of-type>div>div:first-child>div>a{display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;color:hsl(var(--foreground));text-decoration:none;font-size:.875rem;line-height:1.25rem}nav>div:first-of-type>div>div:first-child>div>a+a{margin-left:.25rem}nav>div:first-of-type>div>div:first-child>div>a svg{margin-left:.25rem;height:1rem;width:1rem;fill:currentColor}nav>div:first-of-type>div>div:last-child{display:flex;align-items:center}nav>div:first-of-type>div>div:last-child>button{padding:.5rem;border-radius:.375rem;color:hsl(var(--foreground));background:transparent;border:0;cursor:pointer}nav>div:first-of-type>div>div:last-child>button svg{height:1.5rem;width:1.5rem;stroke:currentColor;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}@media (min-width:768px){nav>div:first-of-type>div>div:first-child>div{display:flex}nav>div:first-of-type>div>div:last-child{display:none}}@media (max-width:767.98px){nav>div:first-of-type>div>div:first-child>div{display:none}nav>div:first-of-type>div>div:last-child{display:flex}}" }} />
      </head>
      <body className="bg-background text-foreground min-h-screen">
        <AuthProvider>
          <LanguageProvider
            serverLocale={serverDeterminedLocale}
            initialAvailableLanguages={availableLanguages}
            initialDefaultLanguage={defaultLanguage}
          >
            <CurrentContentProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <PageTransitionProvider> {/* Added PageTransitionProvider here */}
                  <main className="min-h-screen flex flex-col items-center w-full">
                    <div className="flex-1 w-full flex flex-col items-center">
                      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                        <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
                          {!hasEnvVars ? <EnvVarWarning /> : <Header currentLocale={serverDeterminedLocale} />}
                        </div>
                      </nav>
                      <ClientOnlyTransitionOrchestrator>
                        <div className="flex flex-col w-full flex-grow">
                          {children}
                        </div>
                      </ClientOnlyTransitionOrchestrator>

                      <footer className="w-full border-t py-8">
                        <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-6 text-center text-xs px-4">
                          <FooterNavigation />
                          
                          <div className="flex flex-row items-center gap-2">
                            <p className="text-muted-foreground">© {new Date().getFullYear()} My Ultra-Fast CMS. All rights reserved.</p>
                            <ThemeSwitcher />
                          </div>
                        </div>
                      </footer>
                    </div>
                  </main>
                </PageTransitionProvider> {/* Added PageTransitionProvider here */}
              </ThemeProvider>
            </CurrentContentProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
