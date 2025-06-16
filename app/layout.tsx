import fs from 'fs';
import path from 'path';
// app/layout.tsx
import { EnvVarWarning } from "@/components/env-var-warning";
// import { ThemeSwitcher } from "@/components/theme-switcher"; // Will be dynamically imported
import { hasEnvVars } from "@/utils/supabase/check-env-vars";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { createClient as createSupabaseServerClient, getProfileWithRoleServerSide } from '@/utils/supabase/server';
import { CurrentContentProvider } from "@/context/CurrentContentContext"; // Import CurrentContentProvider
// import { PageTransitionProvider } from '@/components/transitions/PageTransitionProvider'; // Will be dynamically imported
// import { ClientOnlyTransitionOrchestrator } from '@/components/transitions/ClientOnlyTransitionOrchestrator'; // Will be dynamically imported
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

import "./styles/globals.css";
import "./styles/non-critical.css";
import Header from "@/components/Header";
import FooterNavigation from "@/components/FooterNavigation";
import { headers, cookies } from 'next/headers';
import { DynamicClientSideTransitionWrapper, DynamicThemeSwitcher } from '@/components/DynamicImportsClient';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const themeCss = fs.readFileSync(path.join(process.cwd(), 'app/styles/theme.css'), 'utf8');

const DEFAULT_LOCALE_FOR_LAYOUT = 'en';

// Removed DynamicPageTransitionProvider and DynamicClientOnlyTransitionOrchestrator dynamic imports

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

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = user ? await getProfileWithRoleServerSide(user.id) : null;

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
    // Fallback to default locale if languages can't be fetched
    serverDeterminedLocale = DEFAULT_LOCALE_FOR_LAYOUT;
  }


  const nonce = headerList.get('x-nonce') || '';
  return (
    <html lang={serverDeterminedLocale} suppressHydrationWarning>
      <head>
<link rel="preconnect" href="https://ppcppwsfnrptznvbxnsz.supabase.co" />
        <link rel="dns-prefetch" href="https://ppcppwsfnrptznvbxnsz.supabase.co" />
        <link rel="dns-prefetch" href="https://pub-a31e3f1a87d144898aeb489a8221f92e.r2.dev" />
        <link rel="dns-prefetch" href="https://aws-0-us-east-1.pooler.supabase.com" />
        <link rel="dns-prefetch" href="https://db.ppcppwsfnrptznvbxnsz.supabase.co" />
        <link rel="dns-prefetch" href="https://realtime.supabase.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style id="critical-css" nonce={nonce} dangerouslySetInnerHTML={{ __html: `*,:after,:before{box-sizing:border-box;border-width:0;border-style:solid;border-color:hsl(var(--border))}:after,:before{--tw-content:""}html:host,html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;tab-size:4;font-family:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";font-feature-settings:normal;font-variation-settings:normal;-webkit-tap-highlight-color:transparent}body{margin:0;line-height:inherit}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;font-feature-settings:normal;font-variation-settings:normal;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}button,input,optgroup,select,textarea{font-family:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-size:100%;font-weight:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}button,input:where([type=button]),input:where([type=reset]),input:where([type=submit]){-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset{margin:0;padding:0}legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{opacity:1;color:hsl(var(--muted-foreground))}input::placeholder,textarea::placeholder{opacity:1;color:hsl(var(--muted-foreground))}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}[hidden]{display:none}${themeCss}` }} />
      </head>
      <body className="bg-background text-foreground min-h-screen" nonce={nonce}>
        <AuthProvider serverUser={user} serverProfile={profile}>
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
                nonce={nonce}
              >
                <DynamicClientSideTransitionWrapper>
                  <main className="min-h-screen flex flex-col items-center w-full">
                    <div className="flex-1 w-full flex flex-col items-center">
                      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                        <div className="w-full max-w-7xl flex justify-between items-center p-3 px-5 text-sm">
                          {!hasEnvVars ? <EnvVarWarning /> : <Header currentLocale={serverDeterminedLocale} />}
                        </div>
                      </nav>
                      <div className="flex flex-col w-full flex-grow">
                        {children}
                      </div>
                      <footer className="w-full border-t py-8">
                        <div className="mx-auto flex flex-col items-center justify-center gap-6 text-center text-xs">
                          <FooterNavigation />
                          <div className="flex flex-row items-center gap-2">
                            <p className="text-muted-foreground">© {new Date().getFullYear()} My Ultra-Fast CMS. All rights reserved.</p>
                            <DynamicThemeSwitcher />
                          </div>
                        </div>
                      </footer>
                    </div>
                  </main>
                </DynamicClientSideTransitionWrapper>
              </ThemeProvider>
            </CurrentContentProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
