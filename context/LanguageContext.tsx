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
}

export const LanguageProvider = ({ children, serverLocale }: LanguageProviderProps) => {
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

  const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState<Language | null>(null);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);

  useEffect(() => {
    const fetchAndSetLanguages = async () => {
      setIsLoadingLanguages(true);
      const fetchedLanguages = await getActiveLanguagesClientSide();
      setAvailableLanguages(fetchedLanguages);

      const dbDefaultLang = fetchedLanguages.find(lang => lang.is_default) || fetchedLanguages[0] || null;
      setDefaultLanguage(dbDefaultLang);

      let determinedEffectiveLocale = DEFAULT_FALLBACK_LOCALE;
      const isValidLang = (lc: string | undefined) => lc && fetchedLanguages.some(lang => lang.code === lc);

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
          } else if (dbDefaultLang && isValidLang(dbDefaultLang.code)) {
            determinedEffectiveLocale = dbDefaultLang.code;
          } else if (fetchedLanguages.length > 0 && isValidLang(fetchedLanguages[0].code)) {
            determinedEffectiveLocale = fetchedLanguages[0].code;
          }
        }
      }
      
      if (!fetchedLanguages.some(lang => lang.code === determinedEffectiveLocale)) {
          if (fetchedLanguages.length > 0) {
              determinedEffectiveLocale = fetchedLanguages[0].code;
          } else {
              determinedEffectiveLocale = DEFAULT_FALLBACK_LOCALE;
          }
      }

      _setCurrentLocale(determinedEffectiveLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, determinedEffectiveLocale);
        document.documentElement.lang = determinedEffectiveLocale;
      }
      Cookies.set(LANGUAGE_COOKIE_KEY, determinedEffectiveLocale, { path: '/', expires: 365, sameSite: 'Lax' });
      
      setIsLoadingLanguages(false);
    };

    fetchAndSetLanguages();
  }, [serverLocale]);

  const setCurrentLocaleCallback = useCallback((localeCode: string) => {
    let localeToSet = DEFAULT_FALLBACK_LOCALE;
    let isValidForRouterRefresh = false;

    if (availableLanguages.some(lang => lang.code === localeCode)) {
      localeToSet = localeCode;
      isValidForRouterRefresh = true;
    } else if (availableLanguages.length > 0) {
      const dbDefault = availableLanguages.find(lang => lang.is_default);
      localeToSet = dbDefault?.code || availableLanguages[0]?.code || DEFAULT_FALLBACK_LOCALE;
      isValidForRouterRefresh = true;
    } else {
      isValidForRouterRefresh = true; // Still attempt refresh with fallback
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
