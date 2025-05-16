// app/blog/[slug]/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from 'next';
import type { Post as PostType, Block as BlockType, Language, ImageBlockContent, Media } from "@/utils/supabase/types";
import PostClientContent from "./PostClientContent"; // We will create this next

// Ensure this directory structure exists: app/blog/[slug]/

export const dynamicParams = true; // Allow new slugs to be rendered at request time if not pre-built
export const revalidate = 3600; // Revalidate static pages every hour (adjust as needed)

interface PostPageProps {
  params: Promise<{
    slug: string; // Slug is language-specific and unique within its language for posts
  }>;
}

// Fetch post data directly by its language-specific slug.
// Includes logic to fetch object_key for image blocks.
export async function getPostDataBySlug(slug: string): Promise<(PostType & { blocks: BlockType[]; language_code: string; language_id: number; translation_group_id: string; }) | null> {
  const supabase = createClient();

  const { data: postData, error: postError } = await supabase
    .from("posts")
    .select(`
      *,
      languages!inner (id, code), 
      blocks (*)
    `)
    .eq("slug", slug) // Find the post by its unique slug for this language
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`) // Check published_at
    .order('order', { foreignTable: 'blocks', ascending: true })
    .maybeSingle();

  if (postError || !postData) {
    if(postError) console.error(`Error fetching post data for slug '${slug}':`, postError);
    return null;
  }

  // Ensure language information is correctly extracted
  const langInfo = postData.languages as unknown as { id: number; code: string };
  if (!langInfo || !langInfo.id || !langInfo.code) {
      console.error(`Language information missing or incomplete for post slug '${slug}'. DB response:`, postData.languages);
      // Handle this case: either return null or try to proceed if language_id is on postData directly
      if (!postData.language_id) return null; // Critical if we can't determine language
      // If postData.language_id exists but join failed, try to get code separately (less ideal)
      const {data: fallbackLang} = await supabase.from("languages").select("code").eq("id", postData.language_id).single();
      if (!fallbackLang) return null;
      Object.assign(langInfo, {id: postData.language_id, code: fallbackLang.code });
  }
  
  if (!postData.translation_group_id) {
      console.error(`Post with slug '${slug}' is missing a translation_group_id.`);
      // This is critical for language switching logic.
      // You might decide to return null or handle it as a data integrity issue.
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
        .from('media').select('id, object_key').in('id', imageBlockMediaIds);
      if (mediaError) {
        console.error("SSG (Posts): Error fetching media items for blocks:", mediaError);
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
    language_id: langInfo.id, // Ensure this is correctly assigned
    translation_group_id: postData.translation_group_id, // Ensure this is present
  } as (PostType & { blocks: BlockType[]; language_code: string; language_id: number; translation_group_id: string; });
}

// Generate static paths for all unique, published post slugs across all languages
export async function generateStaticParams(): Promise<PostPageProps['params'][]> {
  const supabase = createClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("slug") // Select all published slugs
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);

  if (error || !posts) {
    console.error("SSG (Posts): Error fetching post slugs for static params", error);
    return [];
  }
  // Slugs are already language-specific and unique per language in the DB
  return posts.map((post) => ({ slug: post.slug }));
}

// Generate metadata for the specific post slug
export async function generateMetadata(props: PostPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;
  const postData = await getPostDataBySlug(params.slug);

  if (!postData) {
    return {
      title: "Post Not Found",
      description: "The post you are looking for does not exist or is not yet published.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const supabase = createClient();
  const { data: languages } = await supabase.from('languages').select('id, code');
  // Fetch other language versions of this post using translation_group_id
  const { data: postTranslations } = await supabase
    .from('posts')
    .select('language_id, slug')
    .eq('translation_group_id', postData.translation_group_id) // Find by group
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);

  const alternates: { [key: string]: string } = {};
  if (languages && postTranslations) {
    postTranslations.forEach(pt => {
      const langInfo = languages.find(l => l.id === pt.language_id);
      if (langInfo) {
        // Each language version has its own slug
        alternates[langInfo.code] = `${siteUrl}/blog/${pt.slug}`;
      }
    });
  }

  return {
    title: postData.meta_title || postData.title,
    description: postData.meta_description || postData.excerpt || "",
    openGraph: {
      title: postData.meta_title || postData.title,
      description: postData.meta_description || postData.excerpt || "",
      type: 'article',
      publishedTime: postData.published_at || postData.created_at,
      url: `${siteUrl}/blog/${params.slug}`, // URL of the current language version
      // images: [postData.featured_image_url || defaultOgImage],
      // authors: [postData.author_name],
    },
    alternates: {
      canonical: `${siteUrl}/blog/${params.slug}`, // Canonical is the current specific slug URL
      languages: Object.keys(alternates).length > 0 ? alternates : undefined,
    },
  };
}

// Server Component: Fetches data for the specific slug and passes to Client Component
export default async function DynamicPostPage(props: PostPageProps) {
  const params = await props.params;
  const initialPostData = await getPostDataBySlug(params.slug);

  if (!initialPostData) {
    // If the specific slug doesn't resolve to a published post in any language,
    // then it's a 404. The smart redirect logic would be an enhancement on top of this.
    notFound();
  }

  return (
    <PostClientContent
      initialPostData={initialPostData} // This data is for the language of the current slug
      currentSlug={params.slug}
    />
  );
}
