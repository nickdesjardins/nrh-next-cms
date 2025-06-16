// app/[slug]/PageClientContent.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation'; // For navigation on lang switch
import { createClient } from "@/utils/supabase/client";
import type { Page as PageType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import { useLanguage } from '@/context/LanguageContext';
import { useCurrentContent } from '@/context/CurrentContentContext';
import { AnimatedLink } from '@/components/transitions'; // Changed to AnimatedLink
import { usePageTransition } from '@/components/transitions'; // Added for programmatic nav

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
  const { currentContent, setCurrentContent } = useCurrentContent();
  const router = useRouter();
  const { setTransitioning } = usePageTransition(); // Added
  // currentPageData is the data for the slug currently in the URL.
  // It's initially set by the server for the slug it resolved.
  const [currentPageData, setCurrentPageData] = useState(initialPageData);
  const [isLoadingTargetLang, setIsLoadingTargetLang] = useState(false);

  // Memoize pageId and pageSlug
  const pageId = useMemo(() => currentPageData?.id, [currentPageData?.id]);
  const pageSlug = useMemo(() => currentPageData?.slug, [currentPageData?.slug]);

  useEffect(() => {
    if (currentLocale && currentPageData && currentPageData.language_code !== currentLocale && translatedSlugs) {
      // Current page's language doesn't match context, try to navigate to translated version
      setIsLoadingTargetLang(true);
      const targetSlug = translatedSlugs[currentLocale];
      
      if (targetSlug && targetSlug !== currentSlug) {
        setTransitioning(true); // Added: Start transition
        // Small delay to allow exit animation to start
        setTimeout(() => {
          router.push(`/${targetSlug}`); // Navigate to the translated slug's URL
        }, 50); // Adjust delay as needed
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

  // Effect for setting or updating the context
  useEffect(() => {
    const newType = 'page' as const;
    const slugToSet = pageSlug ?? null; // Ensures slug is string or null

    const needsUpdate = pageId &&
                        (currentContent.id !== pageId ||
                         currentContent.type !== newType ||
                         currentContent.slug !== slugToSet);

    const needsClearing = !pageId &&
                          (currentContent.id !== null ||
                           currentContent.type !== null ||
                           currentContent.slug !== null);

    if (needsUpdate) {
      setCurrentContent({ id: pageId, type: newType, slug: slugToSet });
    } else if (needsClearing) {
      setCurrentContent({ id: null, type: null, slug: null });
    }
  }, [pageId, pageSlug, setCurrentContent]);

  // Separate useEffect for cleanup
  useEffect(() => {
    const idToClean = pageId; // Capture the pageId when this effect runs

    return () => {
      // Cleanup logic: only clear context if the current context ID matches the ID this instance was managing
      if (idToClean && currentContent.id === idToClean) {
        setCurrentContent({ id: null, type: null, slug: null });
      }
    };
  }, [pageId, setCurrentContent]); // MODIFIED: Removed currentContent.id from dependencies

  if (!currentPageData && !isLoadingLanguages && !isLoadingTargetLang) { // If initial data was null and no target lang found
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className="text-muted-foreground">The page for slug "{currentSlug}" could not be loaded or is not available in any language.</p>
        <p className="mt-4"><AnimatedLink href="/" className="text-primary hover:underline">Go to Homepage</AnimatedLink></p>
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
    <article className="w-full mx-auto">
      {isLoadingTargetLang && <div className="text-center py-2 text-sm text-muted-foreground">Switching language...</div>}
      
      {/* Render blocks passed as children */}
      {children}
    </article>
  );
}
