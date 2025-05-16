// app/cms/pages/[id]/edit/page.tsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/server";
import PageForm from "../../components/PageForm";
import { updatePage } from "../../actions";
import type { Page, Block, Language } from "@/utils/supabase/types";
import { notFound, redirect } from "next/navigation";
import BlockEditorArea from "@/app/cms/blocks/components/BlockEditorArea";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye, ArrowLeft } from "lucide-react";
import ContentLanguageSwitcher from "@/app/cms/components/ContentLanguageSwitcher"; // Import new component
import { getActiveLanguagesServerSide } from "@/utils/supabase/server"; // To get all languages

interface PageWithBlocks extends Page {
  blocks: Block[];
  language_code?: string; // From joined languages table
}

async function getPageDataWithBlocks(id: number): Promise<PageWithBlocks | null> {
  const supabase = createClient();
  const { data: pageData, error: pageError } = await supabase
    .from("pages")
    .select(`
      *,
      languages!inner (code),
      blocks (*)
    `)
    .eq("id", id)
    .order('order', { foreignTable: 'blocks', ascending: true })
    .single();

  if (pageError) {
    console.error("Error fetching page with blocks for edit:", pageError);
    return null;
  }

  // Fix: pageData.languages may be an array or object depending on join
  const langCode = Array.isArray(pageData.languages)
    ? pageData.languages[0]?.code
    : (pageData.languages as Language)?.code;

  return { ...pageData, blocks: pageData.blocks || [], language_code: langCode } as PageWithBlocks;
}

export default async function EditPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const pageId = parseInt(params.id, 10);
  if (isNaN(pageId)) return notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/sign-in?redirect=/cms/pages/${pageId}/edit`);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['ADMIN', 'WRITER'].includes(profile.role)) {
      return <div className="p-6">Access Denied.</div>;
  }

  const [pageWithBlocks, allSiteLanguages] = await Promise.all([
    getPageDataWithBlocks(pageId),
    getActiveLanguagesServerSide() // Fetch all languages for the switcher
  ]);

  if (!pageWithBlocks) return notFound();

  const updatePageWithId = updatePage.bind(null, pageId);
  const publicPageUrl = `/${pageWithBlocks.slug}`;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
            <Link href="/cms/pages">
                <Button variant="outline" size="icon" aria-label="Back to pages">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            </Link>
            <div>
                <h1 className="text-2xl font-bold">Edit Page</h1>
                <p className="text-sm text-muted-foreground truncate max-w-md" title={pageWithBlocks.title}>{pageWithBlocks.title}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {allSiteLanguages.length > 0 && (
                 <ContentLanguageSwitcher
                    currentItem={pageWithBlocks}
                    itemType="page"
                    allSiteLanguages={allSiteLanguages}
                  />
            )}
            <Link href={publicPageUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" /> View Live
              </Button>
            </Link>
        </div>
      </div>

      <PageForm
        page={pageWithBlocks}
        formAction={updatePageWithId}
        actionButtonText="Update Page Metadata"
        isEditing={true}
        // Pass allSiteLanguages to PageForm if it needs to disable language select when only one lang exists
        // or for other language-aware logic within the form itself.
        // allSiteLanguages={allSiteLanguages} 
      />

      <Separator className="my-8" />

      <div>
        <h2 className="text-xl font-semibold mb-4">Page Content Blocks</h2>
        <BlockEditorArea
          parentId={pageWithBlocks.id}
          parentType="page"
          initialBlocks={pageWithBlocks.blocks}
          languageId={pageWithBlocks.language_id}
        />
      </div>
    </div>
  );
}
