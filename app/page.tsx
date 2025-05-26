// app/page.tsx (New Approach)
import React from 'react';
import { createClient } from '../utils/supabase/server'; // Corrected path
import { cookies, headers } from 'next/headers'; // Import headers
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from 'next';
import PageClientContent from "./[slug]/PageClientContent"; // Reuse your existing client content component
import { getPageDataBySlug } from "./[slug]/page.utils";   // Reuse your existing data fetching utility
import BlockRenderer from "../components/BlockRenderer";  // Adjust path as needed

const DEFAULT_LOCALE = 'en';
const LANGUAGE_COOKIE_KEY = 'NEXT_USER_LOCALE';

// Helper to determine the correct homepage slug based on locale
async function getHomepageSlugForLocale(locale: string): Promise<string> {
  // This logic assumes you have specific slugs for homepages, e.g., 'home' for 'en', 'accueil' for 'fr'
  // You might fetch this from a 'settings' table or have it hardcoded
  // Your seed data uses 'home' for EN and 'accueil' for FR.
  // The navigation items also link '/' to these specific page IDs.
  // We need to find the page with a specific "home" role/flag or use known slugs.

  // Option 1: Hardcoded mapping (simplest if slugs are fixed)
  if (locale === 'fr') {
    return 'accueil';
  }
  return 'home'; // Default to English homepage slug

  // Option 2: Query based on a "is_homepage" flag or a known title/tag in your 'pages' table
  // (This would require schema modification or a convention)
  // const supabase = createClient();
  // const { data, error } = await supabase
  //   .from('pages')
  //   .select('slug')
  //   .eq('language_code', locale) // Assuming you add a language_code column or join with languages
  //   .eq('is_homepage_flag', true) // Hypothetical flag
  //   .single();
  // if (data?.slug) return data.slug;
  // return locale === 'fr' ? 'accueil' : 'home'; // Fallback
}

export async function generateMetadata(
  {}, // params will be empty for the root page
  parent: ResolvingMetadata
): Promise<Metadata> {
  const head = await headers(); // Use Next.js headers()
  const supabase = createClient();

  let currentLocale = head.get('x-user-locale') || DEFAULT_LOCALE; // Get locale from middleware header

  // Optionally, verify locale and fetch default from DB if header is missing/invalid
  // This logic is similar to your original app/page.tsx
  if (!head.get('x-user-locale')) {
      const cookieStore = await cookies();
      const cookieLocale = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
      if (cookieLocale) {
          currentLocale = cookieLocale;
      } else {
        const { data: langData, error: langError } = await supabase
          .from('languages')
          .select('code')
          .eq('is_default', true)
          .single();
        if (langData && !langError) {
          currentLocale = langData.code;
        }
      }
  }


  const homepageSlug = await getHomepageSlugForLocale(currentLocale);
  const pageData = await getPageDataBySlug(homepageSlug);

  if (!pageData) {
    return { title: "Homepage Not Found" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  // Fetch translations for hreflang (this part can be reused from your [slug]/page.tsx)
  const { data: siteLanguages } = await supabase.from('languages').select('id, code');
  const { data: pageTranslations } = await supabase
    .from('pages')
    .select('language_id, slug')
    .eq('translation_group_id', pageData.translation_group_id) // Assumes homepages share a translation_group_id
    .eq('status', 'published');

  const alternates: { [key: string]: string } = {};
  if (siteLanguages && pageTranslations) {
    pageTranslations.forEach((pt: { language_id: number; slug: string }) => {
      const langInfo = siteLanguages.find((l: { id: number; code: string }) => l.id === pt.language_id);
      if (langInfo) {
        // For the root path, hreflang should point to the root for other languages too,
        // if they are also served from the root based on cookie/header.
        // Or, if you want hreflang to point to the explicit slugs:
        // alternates[langInfo.code] = `${siteUrl}/${pt.slug}`;
        // Given your goal, pointing hreflang to "/" for all homepages is more accurate
        alternates[langInfo.code] = `${siteUrl}/`;
      }
    });
  }

  return {
    title: pageData.meta_title || pageData.title,
    description: pageData.meta_description || "",
    alternates: {
      canonical: `${siteUrl}/`, // Canonical for the homepage is the root
      languages: Object.keys(alternates).length > 0 ? alternates : undefined,
    },
  };
}

export default async function RootPage() {
  const head = await headers();
  const supabase = createClient();
  let currentLocale = head.get('x-user-locale') || DEFAULT_LOCALE;

   if (!head.get('x-user-locale')) {
      const cookieStore = await cookies();
      const cookieLocale = cookieStore.get(LANGUAGE_COOKIE_KEY)?.value;
      if (cookieLocale) {
          currentLocale = cookieLocale;
      } else {
        const { data: langData, error: langError } = await supabase
          .from('languages')
          .select('code')
          .eq('is_default', true)
          .single();
        if (langData && !langError) {
          currentLocale = langData.code;
        }
      }
  }

  const homepageSlug = await getHomepageSlugForLocale(currentLocale);
  const pageData = await getPageDataBySlug(homepageSlug);

  if (!pageData) {
    // This scenario means that for the detected locale, the corresponding homepage slug ('home' or 'accueil')
    // does not exist or is not published.
    // Your seed migration (20250521143933_seed_homepage_and_nav.sql) creates these.
    // Ensure they remain published.
    console.error(`Homepage data not found for slug: ${homepageSlug} (locale: ${currentLocale})`);
    notFound();
  }

  const pageBlocks = pageData ? <BlockRenderer blocks={pageData.blocks} languageId={pageData.language_id} /> : null;

  // Pass currentSlug as homepageSlug to PageClientContent, so it knows what content it's rendering.
  // PageClientContent's logic for language switching will still work if the user changes language via the switcher.
  return (
    <PageClientContent initialPageData={pageData} currentSlug={homepageSlug}>
      {pageBlocks}
    </PageClientContent>
  );
}