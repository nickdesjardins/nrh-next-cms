// app/[slug]/page.tsx
import React from 'react';
import { getSsgSupabaseClient } from "@/utils/supabase/ssg-client"; // Correct import
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from 'next';
import PageClientContent from "./PageClientContent";
import { getPageDataBySlug } from "./page.utils";
import BlockRenderer from "../../components/BlockRenderer";

export const dynamicParams = true;
export const revalidate = 3600;

interface ResolvedPageParams {
  slug: string;
}

interface PageProps {
  params: Promise<ResolvedPageParams>;
}

export async function generateStaticParams(): Promise<ResolvedPageParams[]> {
  const supabase = getSsgSupabaseClient(); // Use the SSG-safe client
  const { data: pages, error } = await supabase
    .from("pages")
    .select("slug")
    .eq("status", "published");

  if (error || !pages) {
    console.error("SSG: Error fetching page slugs for static params:", error);
    return [];
  }
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata(
  { params: paramsPromise }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await paramsPromise;
  // getPageDataBySlug now uses the SSG-safe client internally
  const pageData = await getPageDataBySlug(params.slug);

  if (!pageData) {
    return { title: "Page Not Found" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const supabase = getSsgSupabaseClient(); // Use SSG-safe client for additional queries
  const { data: languages } = await supabase.from('languages').select('id, code');
  const { data: pageTranslations } = await supabase
    .from('pages')
    .select('language_id, slug')
    .eq('translation_group_id', pageData.translation_group_id)
    .eq('status', 'published');

  const alternates: { [key: string]: string } = {};
  if (languages && pageTranslations) {
    pageTranslations.forEach(pt => {
      const langInfo = languages.find(l => l.id === pt.language_id);
      if (langInfo) {
        alternates[langInfo.code] = `${siteUrl}/${pt.slug}`;
      }
    });
  }

  return {
    title: pageData.meta_title || pageData.title,
    description: pageData.meta_description || "",
    alternates: {
      canonical: `${siteUrl}/${params.slug}`,
      languages: Object.keys(alternates).length > 0 ? alternates : undefined,
    },
  };
}

export default async function DynamicPage({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  // getPageDataBySlug uses SSG-safe client, suitable for build and request time for public data
  const pageData = await getPageDataBySlug(params.slug);

  if (!pageData) {
    notFound();
  }

  let translatedSlugs: { [key: string]: string } = {};
  if (pageData.translation_group_id) {
    const supabase = getSsgSupabaseClient();
    const { data: translations } = await supabase
      .from("pages")
      .select("slug, languages!inner(code)")
      .eq("translation_group_id", pageData.translation_group_id)
      .eq("status", "published");

    if (translations) {
      translations.forEach((translation: any) => {
        if (translation.languages && typeof translation.languages.code === 'string' && translation.slug) {
          translatedSlugs[translation.languages.code] = translation.slug;
        }
      });
    }
  }

  const pageBlocks = pageData ? <BlockRenderer blocks={pageData.blocks} languageId={pageData.language_id} /> : null;

  return (
    <PageClientContent initialPageData={pageData} currentSlug={params.slug} translatedSlugs={translatedSlugs}>
      {pageBlocks}
    </PageClientContent>
  );
}