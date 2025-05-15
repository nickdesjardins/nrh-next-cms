// app/cms/pages/[id]/edit/page.tsx
import React from "react";
import { createClient } from "@/utils/supabase/server";
import PageForm from "../../components/PageForm";
import { updatePage } from "../../actions";
import type { Page, Block } from "@/utils/supabase/types"; // Import Block type
import { notFound } from "next/navigation";
import BlockEditorArea from "@/app/cms/blocks/components/BlockEditorArea"; // We will create this

interface PageWithBlocks extends Page {
  blocks: Block[];
}

async function getPageDataWithBlocks(id: number): Promise<PageWithBlocks | null> {
  const supabase = createClient();
  const { data: pageData, error: pageError } = await supabase
    .from("pages")
    .select(`
      *,
      blocks (
        *
      )
    `)
    .eq("id", id)
    .order('order', { foreignTable: 'blocks', ascending: true }) // Order blocks
    .single();

  if (pageError) {
    console.error("Error fetching page with blocks for edit:", pageError);
    return null;
  }
  // Ensure blocks is an array, even if null from DB
  return { ...pageData, blocks: pageData.blocks || [] } as PageWithBlocks;
}

export default async function EditPage({ params }: { params: { id: string } }) {
  const pageId = parseInt(params.id, 10);
  if (isNaN(pageId)) {
    return notFound();
  }

  const pageWithBlocks = await getPageDataWithBlocks(pageId);

  if (!pageWithBlocks) {
    return notFound();
  }

  const updatePageWithId = updatePage.bind(null, pageId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Edit Page: {pageWithBlocks.title}</h1>
        <PageForm // This form handles page metadata (title, slug, etc.)
          page={pageWithBlocks}
          formAction={updatePageWithId}
          actionButtonText="Update Page Metadata"
          isEditing={true}
        />
      </div>

      <hr className="my-8" />

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
