// components/LanguageSwitcher.tsx
'use client';

import { useLanguage } from '@/context/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Assuming shadcn/ui

export default function LanguageSwitcher() {
  const { currentLocale, setCurrentLocale, availableLanguages, isLoadingLanguages } = useLanguage();
  console.log('[LanguageSwitcher] Rendering with currentLocale from context:', currentLocale, 'IsLoading:', isLoadingLanguages);
  
  if (isLoadingLanguages || availableLanguages.length <= 1) {
    // Don't show switcher if loading, or only one language (or no languages)
    return null;
  }

  const handleValueChange = (newLocale: string) => {
    setCurrentLocale(newLocale);
  };

  return (
    <div className="flex items-center">
      <Select value={currentLocale} onValueChange={handleValueChange}>
        <SelectTrigger className="h-9 text-xs sm:text-sm"> {/* Adjusted size */}
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {availableLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}