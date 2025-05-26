// context/LanguageContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Language } from '@/utils/supabase/types';
import { getActiveLanguagesClientSide } from '@/utils/supabase/client';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

const LANGUAGE_STORAGE_KEY = 'preferred_locale_storage';
const LANGUAGE_COOKIE_KEY = 'NEXT_USER_LOCALE';
const DEFAULT_FALLBACK_LOCALE = 'en'; // Your ultimate fallback

interface LanguageContextType {
  currentLocale: string;
  setCurrentLocale: (localeCode: string) => void;
  availableLanguages: Language[];
  defaultLanguage: Language | null;
  isLoadingLanguages: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  serverLocale?: string; // Locale determined on the server (from X-User-Locale header)
  initialAvailableLanguages?: Language[]; // Languages fetched on the server
  initialDefaultLanguage?: Language | null; // Default language determined on the server
}

export const LanguageProvider = ({
  children,
  serverLocale,
  initialAvailableLanguages,
  initialDefaultLanguage
}: LanguageProviderProps) => {
  const router = useRouter();

  const [currentLocale, _setCurrentLocale] = useState<string>(() => {
    let initialVal = DEFAULT_FALLBACK_LOCALE;
    if (serverLocale) {
      initialVal = serverLocale;
    } else {
        const cookieVal = Cookies.get(LANGUAGE_COOKIE_KEY);
        if (cookieVal) {
            initialVal = cookieVal;
        } else {
            const storageVal = typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
            if (storageVal) {
                initialVal = storageVal;
            }
        }
    }
    return initialVal;
  });

  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(initialAvailableLanguages || []);
  const [defaultLanguage, setDefaultLanguage] = useState<Language | null>(initialDefaultLanguage || null);
  // isLoadingLanguages is true if server didn't provide initial languages, or if they were empty.
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(!initialAvailableLanguages || initialAvailableLanguages.length === 0);

  useEffect(() => {
    const initializeLanguages = async () => {
      let languagesToUse = initialAvailableLanguages;
      let defaultLangToUse = initialDefaultLanguage;

      // If server didn't provide languages, or they were empty, fetch client-side as a fallback.
      if (!languagesToUse || languagesToUse.length === 0) {
        languagesToUse = await getActiveLanguagesClientSide();
        setAvailableLanguages(languagesToUse);
        defaultLangToUse = languagesToUse.find(lang => lang.is_default) || languagesToUse[0] || null;
        setDefaultLanguage(defaultLangToUse);
      }
      
      // Determine effective locale based on serverLocale, cookies, localStorage, or DB default
      let determinedEffectiveLocale = DEFAULT_FALLBACK_LOCALE;
      const isValidLang = (lc: string | undefined) => lc && languagesToUse && languagesToUse.some(lang => lang.code === lc);

      if (isValidLang(serverLocale)) {
        determinedEffectiveLocale = serverLocale!;
      } else {
        const cookieVal = Cookies.get(LANGUAGE_COOKIE_KEY);
        if (isValidLang(cookieVal)) {
          determinedEffectiveLocale = cookieVal!;
        } else {
          const storageVal = typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
          if (isValidLang(storageVal || undefined)) {
            determinedEffectiveLocale = storageVal!;
          } else if (defaultLangToUse && isValidLang(defaultLangToUse.code)) {
            determinedEffectiveLocale = defaultLangToUse.code;
          } else if (languagesToUse && languagesToUse.length > 0 && isValidLang(languagesToUse[0].code)) {
            determinedEffectiveLocale = languagesToUse[0].code;
          }
        }
      }
      
      // Final check to ensure determined locale is actually in the available list
      if (languagesToUse && !languagesToUse.some(lang => lang.code === determinedEffectiveLocale)) {
          if (languagesToUse.length > 0) {
              determinedEffectiveLocale = languagesToUse[0].code;
          } else {
              // This case should be rare if getActiveLanguagesClientSide always returns something or errors
              determinedEffectiveLocale = DEFAULT_FALLBACK_LOCALE;
          }
      }

      _setCurrentLocale(determinedEffectiveLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, determinedEffectiveLocale);
        document.documentElement.lang = determinedEffectiveLocale;
      }
      Cookies.set(LANGUAGE_COOKIE_KEY, determinedEffectiveLocale, { path: '/', expires: 365, sameSite: 'Lax' });
      
      setIsLoadingLanguages(false); // Done loading/initializing
    };

    initializeLanguages();
  }, [serverLocale, initialAvailableLanguages, initialDefaultLanguage]);

  const setCurrentLocaleCallback = useCallback((localeCode: string) => {
    let localeToSet = DEFAULT_FALLBACK_LOCALE;
    let isValidForRouterRefresh = false;
    
    const currentAvailableLangs = availableLanguages; // Use state value which might have been updated by client-side fetch

    if (currentAvailableLangs.some(lang => lang.code === localeCode)) {
      localeToSet = localeCode;
      isValidForRouterRefresh = true;
    } else if (currentAvailableLangs.length > 0) {
      const dbDefault = currentAvailableLangs.find(lang => lang.is_default);
      localeToSet = dbDefault?.code || currentAvailableLangs[0]?.code || DEFAULT_FALLBACK_LOCALE;
      isValidForRouterRefresh = true;
    } else {
      // No available languages known, still attempt refresh with fallback
      isValidForRouterRefresh = true;
    }

    _setCurrentLocale(localeToSet);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, localeToSet);
      document.documentElement.lang = localeToSet;
    }
    Cookies.set(LANGUAGE_COOKIE_KEY, localeToSet, { path: '/', expires: 365, sameSite: 'Lax' });

    if (isValidForRouterRefresh) {
      router.refresh();
    }
  }, [availableLanguages, router]);

  useEffect(() => {
    if (currentLocale && typeof window !== 'undefined') {
      document.documentElement.lang = currentLocale;
    }
  }, [currentLocale]);

  const contextValue = React.useMemo(() => {
    return {
      currentLocale: currentLocale,
      setCurrentLocale: setCurrentLocaleCallback,
      availableLanguages,
      defaultLanguage,
      isLoadingLanguages,
    };
  }, [currentLocale, setCurrentLocaleCallback, availableLanguages, defaultLanguage, isLoadingLanguages]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
