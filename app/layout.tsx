// app/layout.tsx
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { getActiveLanguagesServerSide } from "@/utils/supabase/server"; // Import server-side language fetcher
import type { Language } from "@/utils/supabase/types"; // Import Language type
import "./globals.css";
import Header from "@/components/Header";
import FooterNavigation from "@/components/FooterNavigation";
import { headers } from 'next/headers';

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

  const heads = await headers();
  const rawHeaderLocale = heads.get('x-user-locale');
  let serverDeterminedLocale = rawHeaderLocale || DEFAULT_LOCALE_FOR_LAYOUT;

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
      <body className="bg-background text-foreground">
        <AuthProvider>
          <LanguageProvider
            serverLocale={serverDeterminedLocale}
            initialAvailableLanguages={availableLanguages}
            initialDefaultLanguage={defaultLanguage}
          >
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <main className="min-h-screen flex flex-col items-center w-full">
                <div className="flex-1 w-full flex flex-col items-center">
                  <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                    <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
                      {!hasEnvVars ? <EnvVarWarning /> : <Header />}
                    </div>
                  </nav>
                  <div className="flex flex-col w-full">{children}</div>

                  <footer className="w-full border-t py-8">
                    <div className="max-w-7xl mx-auto flex flex-col items-center justify-center gap-6 text-center text-xs px-4">
                      <FooterNavigation />
                      <ThemeSwitcher />
                      <p className="text-muted-foreground">© {new Date().getFullYear()} My Ultra-Fast CMS. All rights reserved.</p>
                    </div>
                  </footer>
                </div>
              </main>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
