// app/cms/blocks/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Block, BlockType } from "@/utils/supabase/types";

// Helper to verify user can edit the parent (page/post)
async function canEditParent(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pageId?: number | null,
  postId?: number | null
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    return false;
  }
  // Further checks could be added here to see if a WRITER owns the page/post
  return true;
}

interface CreateBlockPayload {
  page_id?: number | null;
  post_id?: number | null;
  language_id: number;
  block_type: BlockType;
  content: any; // Initially any, will be structured based on block_type
  order: number;
}

export async function createBlockForPage(pageId: number, languageId: number, blockType: BlockType, order: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "User not authenticated." };
  if (!(await canEditParent(supabase, user.id, pageId, null))) {
    return { error: "Unauthorized to add blocks to this page." };
  }

  let initialContent: any = {};
  switch (blockType) {
    case "text":
      initialContent = { html_content: "<p>New text block...</p>" };
      break;
    case "heading":
      initialContent = { level: 2, text_content: "New Heading" };
      break;
    case "image":
      initialContent = { media_id: null, alt_text: "", caption: "" };
      break;
    case "button":
      initialContent = { text: "Click Me", url: "#", variant: "default", size: "default" };
      break;
    case "posts_grid":
      initialContent = { postsPerPage: 12, columns: 3, showPagination: true, title: "Recent Posts" };
      break;
    default:
      return { error: "Unknown block type." };
  }

  const payload: CreateBlockPayload = {
    page_id: pageId,
    language_id: languageId,
    block_type: blockType,
    content: initialContent,
    order: order,
  };

  const { data, error } = await supabase.from("blocks").insert(payload).select().single();

  if (error) {
    console.error("Error creating block:", error);
    return { error: `Failed to create block: ${error.message}` };
  }

  revalidatePath(`/cms/pages/${pageId}/edit`);
  return { success: true, newBlock: data as Block };
}

export async function createBlockForPost(postId: number, languageId: number, blockType: BlockType, order: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "User not authenticated." };
  if (!(await canEditParent(supabase, user.id, null, postId))) {
    return { error: "Unauthorized to add blocks to this post." };
  }

  let initialContent: any = {};
  switch (blockType) {
    case "text":
      initialContent = { html_content: "<p>New text block...</p>" };
      break;
    case "heading":
      initialContent = { level: 2, text_content: "New Heading" };
      break;
    case "image":
      initialContent = { media_id: null, alt_text: "", caption: "" };
      break;
    case "button":
      initialContent = { text: "Click Me", url: "#", variant: "default", size: "default" };
      break;
    case "posts_grid":
      initialContent = { postsPerPage: 12, columns: 3, showPagination: true, title: "Recent Posts" };
      break;
    default:
      return { error: "Unknown block type." };
  }

  const payload: CreateBlockPayload = {
    post_id: postId,
    language_id: languageId,
    block_type: blockType,
    content: initialContent,
    order: order,
  };

  const { data, error } = await supabase.from("blocks").insert(payload).select().single();

  if (error) {
    console.error("Error creating block:", error);
    return { error: `Failed to create block: ${error.message}` };
  }

  revalidatePath(`/cms/posts/${postId}/edit`);
  return { success: true, newBlock: data as Block };
}

export async function updateBlock(blockId: number, newContent: any, pageId?: number | null, postId?: number | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "User not authenticated." };
  if (!(await canEditParent(supabase, user.id, pageId, postId))) {
    return { error: "Unauthorized to update this block." };
  }

  const { data, error } = await supabase
    .from("blocks")
    .update({ content: newContent, updated_at: new Date().toISOString() })
    .eq("id", blockId)
    .select()
    .single();

  if (error) {
    console.error("Error updating block:", error);
    return { error: `Failed to update block: ${error.message}` };
  }

  if (pageId) revalidatePath(`/cms/pages/${pageId}/edit`);
  if (postId) revalidatePath(`/cms/posts/${postId}/edit`); // For when we add blocks to posts

  return { success: true, updatedBlock: data as Block };
}

export async function updateMultipleBlockOrders(
    updates: Array<{ id: number; order: number }>,
    pageId?: number | null,
    postId?: number | null
) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "User not authenticated." };
    if (!(await canEditParent(supabase, user.id, pageId, postId))) {
        return { error: "Unauthorized to reorder blocks." };
    }

    // Supabase upsert can be used for batch updates if primary key `id` is included.
    // Or loop through updates (less efficient for many updates but simpler to write without complex SQL).
    const updatePromises = updates.map(update =>
        supabase.from('blocks').update({ order: update.order, updated_at: new Date().toISOString() }).eq('id', update.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(result => result.error);

    if (errors.length > 0) {
        console.error("Error updating block orders:", errors.map(e => e.error?.message).join(", "));
        return { error: `Failed to update some block orders: ${errors.map(e => e.error?.message).join(", ")}` };
    }

    if (pageId) revalidatePath(`/cms/pages/${pageId}/edit`);
    if (postId) revalidatePath(`/cms/posts/${postId}/edit`);

    return { success: true };
}


export async function deleteBlock(blockId: number, pageId?: number | null, postId?: number | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "User not authenticated." };
  if (!(await canEditParent(supabase, user.id, pageId, postId))) {
    return { error: "Unauthorized to delete this block." };
  }

  const { error } = await supabase.from("blocks").delete().eq("id", blockId);

  if (error) {
    console.error("Error deleting block:", error);
    return { error: `Failed to delete block: ${error.message}` };
  }

  if (pageId) revalidatePath(`/cms/pages/${pageId}/edit`);
  if (postId) revalidatePath(`/cms/posts/${postId}/edit`);

  return { success: true };
}
