// components/LanguageSwitcher.tsx
'use client';

import { useLanguage } from '@/context/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LanguageSwitcher() {
  const { currentLocale, setCurrentLocale, availableLanguages, isLoadingLanguages } = useLanguage();

  if (isLoadingLanguages || availableLanguages.length <= 1) {
    return null;
  }

  const handleValueChange = (newLocale: string) => {
    setCurrentLocale(newLocale);
  };

  return (
    <div className="flex items-center">
      <Select value={currentLocale} onValueChange={handleValueChange}>
        <SelectTrigger className="h-9 text-xs sm:text-sm">
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
