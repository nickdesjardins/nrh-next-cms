// app/[slug]/PageClientContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // For navigation on lang switch
import { createClient } from "@/utils/supabase/client";
import type { Page as PageType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

interface PageClientContentProps {
  initialPageData: (PageType & { blocks: BlockType[]; language_code: string; language_id: number; translation_group_id: string; }) | null;
  currentSlug: string; // The slug of the currently viewed page
  children: React.ReactNode;
  translatedSlugs?: { [key: string]: string };
}

// Fetches the slug for a given translation_group_id and target language_code
// This function is no longer needed here as slugs are pre-fetched.
// async function getSlugForTranslatedPage(
//   translationGroupId: string,
//   targetLanguageCode: string,
//   supabase: ReturnType<typeof createClient>
// ): Promise<string | null> {
//   const { data: langInfo, error: langErr } = await supabase
//     .from("languages").select("id").eq("code", targetLanguageCode).single();
//   if (langErr || !langInfo) return null;

//   const { data: page, error: pageErr } = await supabase
//     .from("pages")
//     .select("slug")
//     .eq("translation_group_id", translationGroupId)
//     .eq("language_id", langInfo.id)
//     .eq("status", "published")
//     .single();
  
//   if (pageErr || !page) return null;
//   return page.slug;
// }


export default function PageClientContent({ initialPageData, currentSlug, children, translatedSlugs }: PageClientContentProps) {
  const { currentLocale, isLoadingLanguages } = useLanguage();
  const router = useRouter();
  // currentPageData is the data for the slug currently in the URL.
  // It's initially set by the server for the slug it resolved.
  const [currentPageData, setCurrentPageData] = useState(initialPageData);
  const [isLoadingTargetLang, setIsLoadingTargetLang] = useState(false);

  useEffect(() => {
    if (currentLocale && currentPageData && currentPageData.language_code !== currentLocale && translatedSlugs) {
      // Current page's language doesn't match context, try to navigate to translated version
      setIsLoadingTargetLang(true);
      const targetSlug = translatedSlugs[currentLocale];
      
      if (targetSlug && targetSlug !== currentSlug) {
        router.push(`/${targetSlug}`); // Navigate to the translated slug's URL
      } else if (targetSlug && targetSlug === currentSlug) {
        // Already on the correct page for the selected language, do nothing or refresh data if needed
      } else {
        console.warn(`No published translation found for group ${currentPageData.translation_group_id} in language ${currentLocale} using pre-fetched slugs.`);
        // Optionally, provide feedback to the user that translation is not available
      }
      setIsLoadingTargetLang(false);
    }
  }, [currentLocale, currentPageData, currentSlug, router, initialPageData, translatedSlugs]); // Rerun if initialPageData changes (e.g. after revalidation)

  // Update HTML lang attribute based on the *actually displayed* content's language
  useEffect(() => {
    if (currentPageData?.language_code) {
      document.documentElement.lang = currentPageData.language_code;
      if (currentPageData.meta_title || currentPageData.title) {
         document.title = currentPageData.meta_title || currentPageData.title;
      }
    }
  }, [currentPageData]);


  if (!currentPageData && !isLoadingLanguages && !isLoadingTargetLang) { // If initial data was null and no target lang found
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className="text-muted-foreground">The page for slug "{currentSlug}" could not be loaded or is not available in any language.</p>
        <p className="mt-4"><Link href="/" className="text-primary hover:underline">Go to Homepage</Link></p>
      </div>
    );
  }
  
  if (!currentPageData && (isLoadingLanguages || isLoadingTargetLang)) {
     return <div className="container mx-auto px-4 py-20 text-center"><p>Loading page content...</p></div>;
  }
  
  if (!currentPageData) { // Fallback if still no data after loading attempts
     return <div className="container mx-auto px-4 py-20 text-center"><p>Could not load page content.</p></div>;
  }


  return (
    <article className="container mx-auto px-4 py-8">
      {isLoadingTargetLang && <div className="text-center py-2 text-sm text-muted-foreground">Switching language...</div>}
      
      {/* Render blocks passed as children */}
      {children}
    </article>
  );
}
