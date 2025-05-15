// app/[slug]/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import type { Metadata, ResolvingMetadata } from 'next';
import type { Page as PageType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import PageClientContent from "./PageClientContent";

export const dynamicParams = true;
export const revalidate = 3600;

interface PageProps {
  params: { slug: string; };
}

async function getDefaultLanguageInfo(supabase: ReturnType<typeof createClient>): Promise<{ id: number; code: string } | null> {
  const { data: defaultLang, error: langError } = await supabase
    .from("languages").select("id, code").eq("is_default", true).single();
  if (langError || !defaultLang) {
    console.error("SSG Error: Default language not found.", langError);
    const { data: firstLang } = await supabase.from("languages").select("id, code").order('id', {ascending: true}).limit(1).single();
    return firstLang || null;
  }
  return defaultLang;
}

export async function getInitialPageDataForSlug(slug: string): Promise<(PageType & { blocks: BlockType[]; language_code: string; language_id: number }) | null> {
  const supabase = createClient();
  const defaultLanguageInfo = await getDefaultLanguageInfo(supabase);

  if (!defaultLanguageInfo) return null;

  const { data: pageData, error: pageError } = await supabase
    .from("pages")
    .select(`*, blocks (*)`)
    .eq("slug", slug)
    .eq("language_id", defaultLanguageInfo.id)
    .eq("status", "published")
    .order('order', { foreignTable: 'blocks', ascending: true })
    .maybeSingle();

  if (pageError || !pageData) {
    if(pageError) console.error(`Error fetching initial page data for slug '${slug}' (langId: ${defaultLanguageInfo.id}):`, pageError);
    return null;
  }

  let blocksWithMediaData = pageData.blocks || [];
  if (blocksWithMediaData.length > 0) {
    const imageBlockMediaIds = blocksWithMediaData
      .filter((block: BlockType) => (block as any).block_type === 'image' && (block as any).content?.media_id)
      .map((block: BlockType) => ((block as any).content as ImageBlockContent).media_id)
      .filter((id: any) => id !== null) as string[]; // Ensure IDs are strings and not null

    if (imageBlockMediaIds.length > 0) {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('media')
        .select('id, object_key')
        .in('id', imageBlockMediaIds);

      if (mediaError) {
        console.error("Error fetching media items for blocks:", mediaError);
      } else if (mediaItems) {
        const mediaMap = new Map(mediaItems.map((m: any) => [m.id, m.object_key]));
        blocksWithMediaData = blocksWithMediaData.map((block: BlockType) => {
          if ((block as any).block_type === 'image' && (block as any).content?.media_id) {
            const currentContent = (block as any).content as ImageBlockContent;
            const objectKey = mediaMap.get(currentContent.media_id!);
            if (objectKey) {
              return {
                ...block,
                content: { ...currentContent, object_key: objectKey }
              };
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
    language_code: defaultLanguageInfo.code,
    language_id: defaultLanguageInfo.id,
  } as (PageType & { blocks: BlockType[]; language_code: string; language_id: number });
}

export async function generateStaticParams(): Promise<PageProps['params'][]> {
  // ... (remains the same)
  const supabase = createClient();
  const { data: pageEntries, error } = await supabase
    .from("pages")
    .select("slug, language_id")
    .eq("status", "published");

  if (error || !pageEntries) {
    console.error("SSG: Error fetching page slugs for static params", error);
    return [];
  }
  const uniqueSlugs = Array.from(new Set(pageEntries.map(p => p.slug)));
  return uniqueSlugs.map((slug) => ({ slug: slug }));
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // ... (remains largely the same, ensure NEXT_PUBLIC_SITE_URL is set for canonical/hreflang)
  const initialPageData = await getInitialPageDataForSlug(params.slug);
  if (!initialPageData) return { title: "Page Not Found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  // ... (hreflang logic as before) ...
  const supabase = createClient();
  const { data: languages } = await supabase.from('languages').select('id, code');
  const { data: pageTranslations } = await supabase
    .from('pages')
    .select('language_id, slug')
    .eq('slug', params.slug)
    .eq('status', 'published');

  const alternates: { [key: string]: string } = {};
  if (languages && pageTranslations) {
    pageTranslations.forEach(pt => {
      const langInfo = languages.find(l => l.id === pt.language_id);
      if (langInfo) {
        alternates[langInfo.code] = `${siteUrl}/${params.slug}`;
      }
    });
  }

  return {
    title: initialPageData.meta_title || initialPageData.title,
    description: initialPageData.meta_description || "",
    alternates: {
      canonical: `${siteUrl}/${params.slug}`,
      languages: Object.keys(alternates).length > 0 ? alternates : undefined,
    },
  };
}

export default async function DynamicPage({ params }: PageProps) {
  const initialPageData = await getInitialPageDataForSlug(params.slug);
  return (
    <PageClientContent
      slug={params.slug}
      initialPageData={initialPageData}
    />
  );
}
