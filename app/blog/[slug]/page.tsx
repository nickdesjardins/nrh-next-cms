// app/blog/[slug]/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from 'next';
// Removed unused Media, ImageBlockContent from here as they are handled in page.utils.ts
import type { Post as PostType, Block as BlockType, Language } from "@/utils/supabase/types";
import PostClientContent from "./PostClientContent";
import { getPostDataBySlug } from "./page.utils"; // Import from the new utility file

export const dynamicParams = true;
export const revalidate = 3600;

// Define the type for the resolved params object
interface ResolvedPostParams {
  slug: string;
}

// Define the PostPageProps for the component and generateMetadata
interface PostPageProps {
  params: Promise<ResolvedPostParams>; // params is now a Promise
  // searchParams?: { [key: string]: string | string[] | undefined }; // Add if you use searchParams
}

// Generate static paths for all unique, published post slugs across all languages
export async function generateStaticParams(): Promise<ResolvedPostParams[]> { // Return type uses ResolvedPostParams
  const supabase = createClient();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("slug")
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);

  if (error || !posts) {
    console.error("SSG (Posts): Error fetching post slugs for static params", error);
    return [];
  }
  return posts.map((post) => ({ slug: post.slug }));
}

// Generate metadata for the specific post slug
export async function generateMetadata(
  { params: paramsPromise }: PostPageProps, // Destructure the promise
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await paramsPromise; // Await the promise to get the actual params
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
  const { data: postTranslations } = await supabase
    .from('posts')
    .select('language_id, slug')
    .eq('translation_group_id', postData.translation_group_id)
    .eq('status', 'published')
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`);

  const alternates: { [key: string]: string } = {};
  if (languages && postTranslations) {
    postTranslations.forEach(pt => {
      const langInfo = languages.find(l => l.id === pt.language_id);
      if (langInfo) {
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
      url: `${siteUrl}/blog/${params.slug}`,
    },
    alternates: {
      canonical: `${siteUrl}/blog/${params.slug}`,
      languages: Object.keys(alternates).length > 0 ? alternates : undefined,
    },
  };
}

// Server Component: Fetches data for the specific slug and passes to Client Component
export default async function DynamicPostPage({ params: paramsPromise }: PostPageProps) { // Destructure the promise
  const params = await paramsPromise; // Await the promise
  const initialPostData = await getPostDataBySlug(params.slug);

  if (!initialPostData) {
    notFound();
  }

  return (
    <PostClientContent
      initialPostData={initialPostData}
      currentSlug={params.slug}
    />
  );
}
