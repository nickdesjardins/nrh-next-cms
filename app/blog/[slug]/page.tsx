// app/blog/[slug]/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import type { Metadata, ResolvingMetadata } from 'next';
import type { Post as PostType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import PostClientContent from "./PostClientContent"; // We will create this

// Ensure this directory structure exists: app/blog/[slug]/

export const dynamicParams = true; // Allow new slugs to be rendered at request time
export const revalidate = 3600; // Revalidate static pages every hour (adjust as needed)

interface PostPageProps {
  params: {
    slug: string; // Slug is globally unique
  };
}

// Helper to get the ID and code of the default language
async function getDefaultLanguageInfo(supabase: ReturnType<typeof createClient>): Promise<{ id: number; code: string } | null> {
  const { data: defaultLang, error: langError } = await supabase
    .from("languages")
    .select("id, code")
    .eq("is_default", true)
    .single();

  if (langError || !defaultLang) {
    console.error("SSG Error (Posts): Default language not found or multiple defaults set.", langError);
    // Fallback: try to get the first language if no explicit default
    const { data: firstLang } = await supabase.from("languages").select("id, code").order('id', {ascending: true}).limit(1).single();
    if (firstLang) {
        console.warn("SSG Warning (Posts): Using first available language as default.");
        return firstLang;
    }
    return null;
  }
  return defaultLang;
}

// Fetch initial post data (for default language during SSG/ISR)
// This function now includes logic to fetch object_key for image blocks.
export async function getInitialPostDataForSlug(slug: string): Promise<(PostType & { blocks: BlockType[]; language_code: string; language_id: number }) | null> {
  const supabase = createClient();
  const defaultLanguageInfo = await getDefaultLanguageInfo(supabase);

  if (!defaultLanguageInfo) {
    console.error(`SSG (Posts): No default language info found for post slug: ${slug}. Cannot pre-render.`);
    return null;
  }

  const { data: postData, error: postError } = await supabase
    .from("posts")
    .select(`
      *,
      blocks (*)
    `)
    .eq("slug", slug)
    .eq("language_id", defaultLanguageInfo.id)
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`) // Check published_at
    .order('order', { foreignTable: 'blocks', ascending: true })
    .maybeSingle();

  if (postError || !postData) {
    if(postError) console.error(`Error fetching initial post data for slug '${slug}' (langId: ${defaultLanguageInfo.id}):`, postError);
    return null;
  }

  let blocksWithMediaData: BlockType[] = postData.blocks || [];
  if (blocksWithMediaData.length > 0) {
    const imageBlockMediaIds = blocksWithMediaData
      .filter(block => block.block_type === 'image' && block.content?.media_id)
      .map(block => (block.content as ImageBlockContent).media_id)
      .filter(id => id !== null && typeof id === 'string') as string[];

    if (imageBlockMediaIds.length > 0) {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('media')
        .select('id, object_key') // Select id and object_key
        .in('id', imageBlockMediaIds);

      if (mediaError) {
        console.error("SSG (Posts): Error fetching media items for blocks:", mediaError);
      } else if (mediaItems) {
        const mediaMap = new Map(mediaItems.map(m => [m.id, m.object_key]));
        blocksWithMediaData = blocksWithMediaData.map(block => {
          if (block.block_type === 'image' && block.content?.media_id) {
            const currentContent = block.content as ImageBlockContent;
            const objectKey = mediaMap.get(currentContent.media_id!);
            if (objectKey) {
              return {
                ...block,
                content: { ...currentContent, object_key: objectKey } // Add object_key to content
              };
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
    language_code: defaultLanguageInfo.code,
    language_id: defaultLanguageInfo.id,
  } as (PostType & { blocks: BlockType[]; language_code: string; language_id: number });
}

// Generate static paths for all unique, published post slugs
export async function generateStaticParams(): Promise<PostPageProps['params'][]> {
  const supabase = createClient();
  const { data: postEntries, error } = await supabase
    .from("posts")
    .select("slug") // Only need slug for params
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);

  if (error || !postEntries) {
    console.error("SSG (Posts): Error fetching post slugs for static params", error);
    return [];
  }

  const uniqueSlugs = Array.from(new Set(postEntries.map(p => p.slug)));

  return uniqueSlugs.map((slug) => ({
    slug: slug,
  }));
}

// Generate metadata for the post (for default language)
export async function generateMetadata(
  { params }: PostPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const initialPostData = await getInitialPostDataForSlug(params.slug);

  if (!initialPostData) {
    return {
      title: "Post Not Found",
      description: "The post you are looking for does not exist or is not yet published in the default language.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""; // Ensure this is set in .env
  const supabase = createClient();
  const { data: languages } = await supabase.from('languages').select('id, code');
  const { data: postTranslations } = await supabase
    .from('posts')
    .select('language_id, slug') // slug should be the same
    .eq('slug', params.slug)
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);

  const alternates: { [key: string]: string } = {};
  if (languages && postTranslations) {
    postTranslations.forEach(pt => {
      const langInfo = languages.find(l => l.id === pt.language_id);
      if (langInfo) {
        // All language versions point to the same canonical URL for this strategy
        alternates[langInfo.code] = `${siteUrl}/blog/${params.slug}`;
      }
    });
  }

  return {
    title: initialPostData.meta_title || initialPostData.title,
    description: initialPostData.meta_description || initialPostData.excerpt || "",
    openGraph: {
      title: initialPostData.meta_title || initialPostData.title,
      description: initialPostData.meta_description || initialPostData.excerpt || "",
      type: 'article',
      publishedTime: initialPostData.published_at || initialPostData.created_at,
      url: `${siteUrl}/blog/${params.slug}`,
      // images: [initialPostData.featured_image_url || defaultOgImage], // Add featured image logic if available
      // authors: [initialPostData.author_name], // If you fetch author details
    },
    alternates: {
      canonical: `${siteUrl}/blog/${params.slug}`,
      languages: Object.keys(alternates).length > 0 ? alternates : undefined,
    },
  };
}

// Server Component: Fetches initial data for default language and passes to Client Component
export default async function DynamicPostPage({ params }: PostPageProps) {
  const initialPostData = await getInitialPostDataForSlug(params.slug);

  // If initialPostData is null (e.g., post not found in default lang or not published),
  // PostClientContent will handle showing an appropriate message or trying to load current locale.
  // For SSG, if a slug has no default language version, it might not be built unless dynamicParams = true allows it.

  return (
    <PostClientContent
      slug={params.slug}
      initialPostData={initialPostData} // Can be null
    />
  );
}
