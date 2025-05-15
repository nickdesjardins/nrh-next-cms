// app/[slug]/PageClientContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from "@/utils/supabase/client";
import type { Page as PageType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import BlockRenderer from "../../components/BlockRenderer";
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

interface PageClientContentProps {
  slug: string;
  initialPageData: (PageType & { blocks: BlockType[]; language_code: string; language_id: number }) | null;
}

async function fetchPageContentForLanguage(
  slug: string,
  languageCode: string,
  supabase: ReturnType<typeof createClient>
): Promise<(PageType & { blocks: BlockType[]; language_code: string; language_id: number }) | null> {
  const { data: langInfo, error: langError } = await supabase
    .from("languages").select("id, code").eq("code", languageCode).single();

  if (langError || !langInfo) {
    console.warn(`Client: Language code '${languageCode}' not found for slug '${slug}'.`);
    return null;
  }

  const { data: pageData, error: pageError } = await supabase
    .from("pages").select("*, blocks(*)").eq("slug", slug)
    .eq("language_id", langInfo.id).eq("status", "published")
    .order('order', { foreignTable: 'blocks', ascending: true }).maybeSingle();

  if (pageError || !pageData) {
    if(pageError) console.error(`Client: Error fetching page content for slug '${slug}', lang '${languageCode}':`, pageError);
    return null;
  }

  let blocksWithMediaData = pageData.blocks || [];
  if (blocksWithMediaData.length > 0) {
    const imageBlockMediaIds = blocksWithMediaData
      .filter((block: BlockType) => (block as any).block_type === 'image' && (block as any).content?.media_id)
      .map((block: BlockType) => ((block as any).content as ImageBlockContent).media_id)
      .filter((id: any) => id !== null) as string[];

    if (imageBlockMediaIds.length > 0) {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('media').select('id, object_key').in('id', imageBlockMediaIds);
      if (mediaError) {
        console.error("Client: Error fetching media items for blocks:", mediaError);
      } else if (mediaItems) {
        const mediaMap = new Map(mediaItems.map((m: any) => [m.id, m.object_key]));
        blocksWithMediaData = blocksWithMediaData.map((block: BlockType) => {
          if ((block as any).block_type === 'image' && (block as any).content?.media_id) {
            const currentContent = (block as any).content as ImageBlockContent;
            const objectKey = mediaMap.get(currentContent.media_id!);
            if (objectKey) {
              return { ...block, content: { ...currentContent, object_key: objectKey } };
            }
          }
          return block;
        });
      }
    }
  }

  return {
    ...pageData,
    blocks: blocksWithMediaData,
    language_code: langInfo.code,
    language_id: langInfo.id,
  } as (PageType & { blocks: BlockType[]; language_code: string; language_id: number });
}


export default function PageClientContent({ slug, initialPageData }: PageClientContentProps) {
  // ... (useState, useLanguage, useEffect for HTML lang attribute remain the same) ...
  const { currentLocale, isLoadingLanguages, defaultLanguage } = useLanguage();
  const [currentPageData, setCurrentPageData] = useState(initialPageData); // Use initialPageData directly
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (currentLocale) {
      document.documentElement.lang = currentLocale;
    }
  }, [currentLocale]);

  const loadContentForLocale = useCallback(async (localeToLoad: string) => {
    if (!localeToLoad || !slug) return;
    setIsLoadingContent(true);
    setContentError(null);

    // Check if initialData is for the requested locale
    if (initialPageData && initialPageData.language_code === localeToLoad) {
      setCurrentPageData(initialPageData);
      if (initialPageData.meta_title || initialPageData.title) {
        document.title = initialPageData.meta_title || initialPageData.title;
      }
      setIsLoadingContent(false);
      return;
    }
    
    // Fetch if different locale or if initialData was null for the default language
    const data = await fetchPageContentForLanguage(slug, localeToLoad, supabase);
    if (data) {
      setCurrentPageData(data);
      if (data.meta_title || data.title) {
        document.title = data.meta_title || data.title;
      }
    } else {
      setCurrentPageData(null); 
      setContentError(`Content for "${slug}" is not available in ${localeToLoad}.`);
    }
    setIsLoadingContent(false);
  }, [slug, initialPageData, supabase]);

  useEffect(() => {
    if (!isLoadingLanguages && currentLocale) {
      if (!currentPageData || currentPageData.language_code !== currentLocale) {
        loadContentForLocale(currentLocale);
      }
    } else if (!isLoadingLanguages && !currentLocale && defaultLanguage && initialPageData?.language_code !== defaultLanguage.code) {
      // If context hasn't settled, but we have a site default, and initial data isn't it, load default.
       if (!currentPageData || currentPageData.language_id !== defaultLanguage.id) {
            loadContentForLocale(defaultLanguage.code);
        }
    }
  }, [currentLocale, isLoadingLanguages, defaultLanguage, currentPageData, loadContentForLocale, initialPageData]);


  // ... (loading states and error display remain the same) ...
  if (isLoadingLanguages && !currentPageData) {
    return <div className="container mx-auto px-4 py-20 text-center"><p>Loading language settings...</p></div>;
  }
  if (isLoadingContent && !currentPageData) {
     return <div className="container mx-auto px-4 py-20 text-center"><p>Loading content for {currentLocale || 'selected language'}...</p></div>;
  }
  if (!currentPageData) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Content Not Found</h1>
        <p className="text-muted-foreground">The page "{slug}" could not be loaded for the selected language ({currentLocale || 'unknown'}).</p>
        {contentError && <p className="text-red-500 mt-2">{contentError}</p>}
        <p className="mt-4"><Link href="/" className="text-primary hover:underline">Go to Homepage</Link></p>
      </div>
    );
  }

  return (
    <article className="container mx-auto px-4 py-8">
      {isLoadingContent && currentPageData && (
          <div className="text-center py-2 text-sm text-muted-foreground">Updating to {currentLocale}...</div>
      )}
      {currentPageData.blocks && currentPageData.blocks.length > 0 ? (
        <BlockRenderer blocks={currentPageData.blocks} />
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <p>This page has no content blocks for the language: {currentPageData.language_code.toUpperCase()}.</p>
        </div>
      )}
    </article>
  );
}
