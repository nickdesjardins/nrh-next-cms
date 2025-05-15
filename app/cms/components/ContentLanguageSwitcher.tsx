// app/cms/components/ContentLanguageSwitcher.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Languages, CheckCircle } from 'lucide-react';
import type { Language, Page, Post } from '@/utils/supabase/types'; // Assuming these types
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils'; // Add this import for the cn utility

interface ContentLanguageSwitcherProps {
  currentItem: (Page | Post) & { language_code?: string }; // The current page or post being edited
  itemType: 'page' | 'post'; // To construct the correct edit URL
  allSiteLanguages: Language[]; // All available languages in the CMS
}

interface TranslationVersion {
  id: number;
  language_id: number;
  language_code: string;
  language_name: string;
  title: string; // Or some identifier
  status: string;
}

export default function ContentLanguageSwitcher({
  currentItem,
  itemType,
  allSiteLanguages,
}: ContentLanguageSwitcherProps) {
  const [translations, setTranslations] = useState<TranslationVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const pathname = usePathname();

  useEffect(() => {
    if (!currentItem.slug || allSiteLanguages.length === 0) {
      setIsLoading(false);
      return;
    }

    async function fetchTranslations() {
      setIsLoading(true);
      const table = itemType === 'page' ? 'pages' : 'posts';
      const { data, error } = await supabase
        .from(table)
        .select('id, title, status, language_id')
        .eq('slug', currentItem.slug); // Find all items with the same slug

      if (error) {
        console.error(`Error fetching translations for ${itemType} slug ${currentItem.slug}:`, error);
        setTranslations([]);
      } else if (data) {
        const mappedTranslations = data.map(item => {
          const langInfo = allSiteLanguages.find(l => l.id === item.language_id);
          return {
            id: item.id,
            language_id: item.language_id,
            language_code: langInfo?.code || 'unk',
            language_name: langInfo?.name || 'Unknown Language',
            title: item.title,
            status: item.status,
          };
        });
        setTranslations(mappedTranslations);
      }
      setIsLoading(false);
    }

    fetchTranslations();
  }, [currentItem.slug, itemType, supabase, allSiteLanguages]);

  const currentLanguageName = allSiteLanguages.find(l => l.id === currentItem.language_id)?.name || currentItem.language_code;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading language versions...</div>;
  }

  if (allSiteLanguages.length <= 1) {
    return null; // Don't show switcher if only one language
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="ml-auto">
          <Languages className="mr-2 h-4 w-4" />
          Editing: {currentLanguageName} ({currentItem.language_code?.toUpperCase()})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch Language Version</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allSiteLanguages.map(lang => {
          const version = translations.find(t => t.language_id === lang.id);
          const editUrl = `/cms/${itemType === 'page' ? 'pages' : 'posts'}/${version ? version.id : `new?slug=${currentItem.slug}&lang_id=${lang.id}`}/edit`;
          // The 'new' URL part would need a more sophisticated "Create Translation" flow
          // For now, we only link to existing translations.
          // A better approach for non-existing translations is to guide user to create one.

          const isCurrent = lang.id === currentItem.language_id;

          if (version) {
            return (
              <DropdownMenuItem key={lang.id} asChild disabled={isCurrent} className={cn(isCurrent && "bg-accent")}>
                <Link href={editUrl} className="w-full">
                  <div className="flex justify-between items-center w-full">
                    <span>{lang.name} ({lang.code.toUpperCase()})</span>
                    {isCurrent && <CheckCircle className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={version.title}>
                    {version.title} - <span className="capitalize">{version.status}</span>
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          } else {
            // Placeholder for creating a new translation - more complex flow needed
            return (
              <DropdownMenuItem key={lang.id} disabled>
                 <div className="flex justify-between items-center w-full">
                    <span>{lang.name} ({lang.code.toUpperCase()})</span>
                  </div>
                <div className="text-xs text-muted-foreground">Not yet created</div>
              </DropdownMenuItem>
            );
          }
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
