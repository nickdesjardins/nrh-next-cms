// app/blog/[slug]/PostClientContent.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from "@/utils/supabase/client";
import type { Post as PostType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import BlockRenderer from "../../../components/BlockRenderer";
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';

interface PostClientContentProps {
  slug: string;
  initialPostData: (PostType & { blocks: BlockType[]; language_code: string; language_id: number }) | null;
}

// Client-side data fetching function for a specific language
async function fetchPostContentForLanguage(
  slug: string,
  languageCode: string,
  supabase: ReturnType<typeof createClient>
): Promise<(PostType & { blocks: BlockType[]; language_code: string; language_id: number }) | null> {
  const { data: langInfo, error: langError } = await supabase
    .from("languages")
    .select("id, code")
    .eq("code", languageCode)
    .single();

  if (langError || !langInfo) {
    console.warn(`Client (Posts): Language code '${languageCode}' not found for post slug '${slug}'.`);
    return null;
  }

  const { data: postData, error: postError } = await supabase
    .from("posts")
    .select("*, blocks(*)") // Fetch related blocks
    .eq("slug", slug)
    .eq("language_id", langInfo.id)
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`) // Check published_at
    .order('order', { foreignTable: 'blocks', ascending: true })
    .maybeSingle();

  if (postError || !postData) {
    if(postError) console.error(`Client (Posts): Error fetching post content for slug '${slug}', lang '${languageCode}':`, postError);
    return null;
  }

  // Fetch media object_key for image blocks
  let blocksWithMediaData: BlockType[] = postData.blocks || [];
  if (blocksWithMediaData.length > 0) {
    const imageBlockMediaIds = blocksWithMediaData
      .filter(block => block.block_type === 'image' && block.content?.media_id)
      .map(block => (block.content as ImageBlockContent).media_id)
      .filter(id => id !== null && typeof id === 'string') as string[];

    if (imageBlockMediaIds.length > 0) {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('media')
        .select('id, object_key')
        .in('id', imageBlockMediaIds);

      if (mediaError) {
        console.error("Client (Posts): Error fetching media items for blocks:", mediaError);
      } else if (mediaItems) {
        const mediaMap = new Map(mediaItems.map(m => [m.id, m.object_key]));
        blocksWithMediaData = blocksWithMediaData.map(block => {
          if (block.block_type === 'image' && block.content?.media_id) {
            const currentContent = block.content as ImageBlockContent;
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
    ...postData,
    blocks: blocksWithMediaData,
    language_code: langInfo.code,
    language_id: langInfo.id,
  } as (PostType & { blocks: BlockType[]; language_code: string; language_id: number });
}

export default function PostClientContent({ slug, initialPostData }: PostClientContentProps) {
  const { currentLocale, isLoadingLanguages, defaultLanguage } = useLanguage();
  const [currentPostData, setCurrentPostData] = useState(initialPostData);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const supabase = createClient(); // Initialize client-side Supabase client

  useEffect(() => {
    if (currentLocale) {
      document.documentElement.lang = currentLocale;
    }
  }, [currentLocale]);

  const loadContentForLocale = useCallback(async (localeToLoad: string) => {
    if (!localeToLoad || !slug) return;

    setIsLoadingContent(true);
    setContentError(null);

    // If initialData is already for the requested locale, use it
    if (initialPostData && initialPostData.language_code === localeToLoad) {
      setCurrentPostData(initialPostData);
      if (initialPostData.meta_title || initialPostData.title) {
        document.title = initialPostData.meta_title || initialPostData.title;
      }
      setIsLoadingContent(false);
      return;
    }
    
    const data = await fetchPostContentForLanguage(slug, localeToLoad, supabase);
    if (data) {
      setCurrentPostData(data);
      if (data.meta_title || data.title) {
        document.title = data.meta_title || data.title; // Update document title
      }
    } else {
      setCurrentPostData(null); // Clear content if specific language version not found
      setContentError(`Post content for "${slug}" is not available in ${localeToLoad}.`);
      console.warn(`Post content for slug '${slug}' in language '${localeToLoad}' not found.`);
    }
    setIsLoadingContent(false);
  }, [slug, initialPostData, supabase]);

  useEffect(() => {
    if (!isLoadingLanguages && currentLocale) {
      // Fetch if current data is not for currentLocale, or if no data yet
      if (!currentPostData || currentPostData.language_code !== currentLocale) {
        loadContentForLocale(currentLocale);
      }
    } else if (!isLoadingLanguages && !currentLocale && defaultLanguage) {
      // If context hasn't settled, but we have a site default, try loading that if not already loaded
      if (!currentPostData || currentPostData.language_id !== defaultLanguage.id) {
         loadContentForLocale(defaultLanguage.code);
      }
    }
  }, [currentLocale, isLoadingLanguages, defaultLanguage, currentPostData, loadContentForLocale]);


  if (isLoadingLanguages && !currentPostData) {
    return <div className="container mx-auto px-4 py-20 text-center"><p>Loading language settings...</p></div>;
  }
  if (isLoadingContent && !currentPostData) { // Show loading if fetching and no data to display yet
     return <div className="container mx-auto px-4 py-20 text-center"><p>Loading post for {currentLocale || 'selected language'}...</p></div>;
  }

  if (!currentPostData) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
        <p className="text-muted-foreground">
          The post "{slug}" could not be loaded for the selected language ({currentLocale || 'unknown'}).
        </p>
        {contentError && <p className="text-red-500 mt-2">{contentError}</p>}
        <p className="mt-4">
          <Link href="/blog" className="text-primary hover:underline">Back to Blog</Link>
          <span className="mx-2">|</span>
          <Link href="/" className="text-primary hover:underline">Go to Homepage</Link>
        </p>
      </div>
    );
  }

  return (
    <article className="container mx-auto px-4 py-8">
      {/* Optional: Display a loading indicator when switching languages but old content is still visible */}
      {isLoadingContent && currentPostData && (
          <div className="text-center py-2 text-sm text-muted-foreground">Updating to {currentLocale}...</div>
      )}
      <header className="mb-8 text-center border-b pb-6 dark:border-slate-700">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2 text-slate-900 dark:text-slate-100">{currentPostData.title}</h1>
        {currentPostData.published_at && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Published on {new Date(currentPostData.published_at).toLocaleDateString(currentPostData.language_code, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
        {currentPostData.excerpt && <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">{currentPostData.excerpt}</p>}
      </header>

      {currentPostData.blocks && currentPostData.blocks.length > 0 ? (
        <div className="prose dark:prose-invert lg:prose-xl max-w-none mx-auto"> {/* Apply prose for blog post styling */}
          <BlockRenderer blocks={currentPostData.blocks} />
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <p>This post has no content blocks for the language: {currentPostData.language_code.toUpperCase()}.</p>
        </div>
      )}
    </article>
  );
}
