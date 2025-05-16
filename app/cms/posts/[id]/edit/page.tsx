// app/cms/posts/[id]/edit/page.tsx
import React from "react";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/server";
import PostForm from "../../components/PostForm"; // Adjusted path
import { updatePost } from "../../actions";
import type { Post as PostType, Block as BlockType, Language } from "@/utils/supabase/types"; // Ensure Language is imported
import { notFound, redirect } from "next/navigation";
import BlockEditorArea from "@/app/cms/blocks/components/BlockEditorArea";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Eye, ArrowLeft, SeparatorVertical } from "lucide-react"; // Added SeparatorVertical if needed, or use hr
import ContentLanguageSwitcher from "@/app/cms/components/ContentLanguageSwitcher";
import { getActiveLanguagesServerSide } from "@/utils/supabase/server";


interface PostWithBlocks extends PostType {
  blocks: BlockType[];
  language_code?: string; // From joined languages table
  translation_group_id: string; // Ensure this is required
}

async function getPostDataWithBlocks(id: number): Promise<PostWithBlocks | null> {
  const supabase = createClient();
  const { data: postData, error: postError } = await supabase
    .from("posts")
    .select(`
      *,
      languages!inner (code),
      blocks (*)
    `)
    .eq("id", id)
    .order('order', { foreignTable: 'blocks', ascending: true })
    .single(); // Use single, it will error if not found which is fine for an edit page

  if (postError) {
    console.error("Error fetching post with blocks for edit:", postError);
    return null;
  }
  
  // The join syntax `languages!inner (code)` should make `languages` an object if a match is found.
  // If Supabase JS SDK types it as an array, adjust accordingly.
  const langCode = (postData.languages as unknown as Language)?.code;

  // Ensure translation_group_id is included for ContentLanguageSwitcher
  return {
    ...postData,
    blocks: postData.blocks || [],
    language_code: langCode,
    translation_group_id: postData.translation_group_id, // Now always present
  } as PostWithBlocks & { translation_group_id: string };
}

export default async function EditPostPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const postId = parseInt(params.id, 10);
  if (isNaN(postId)) {
    return notFound();
  }

  // Admin/Writer check
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect(`/sign-in?redirect=/cms/posts/${postId}/edit`); // Redirect to sign-in if not authenticated

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['ADMIN', 'WRITER'].includes(profile.role)) {
      // For a cleaner UX, you might redirect to /unauthorized or show a specific component
      return <div className="p-6 text-center text-red-600">Access Denied. You do not have permission to edit posts.</div>;
  }

  const [postWithBlocks, allSiteLanguages] = await Promise.all([
    getPostDataWithBlocks(postId),
    getActiveLanguagesServerSide() // Fetch all languages for the switcher
  ]);

  if (!postWithBlocks) {
    return notFound(); // Or a more specific "Post not found" component
  }

  const updatePostWithId = updatePost.bind(null, postId);

  // Construct the public URL for the "View Live" button
  // This assumes your public post route is `/blog/[slug]` and doesn't include lang segment.
  const publicPostUrl = `/blog/${postWithBlocks.slug}`;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3">
            <Link href="/cms/posts">
                <Button variant="outline" size="icon" aria-label="Back to posts">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            </Link>
            <div>
                <h1 className="text-2xl font-bold">Edit Post</h1>
                <p className="text-sm text-muted-foreground truncate max-w-md" title={postWithBlocks.title}>{postWithBlocks.title}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {allSiteLanguages.length > 0 && ( // Only show switcher if there are languages
                 (<ContentLanguageSwitcher
                    currentItem={postWithBlocks} // Pass the full post object
                    itemType="post"
                    allSiteLanguages={allSiteLanguages}
                  />)
            )}
            <Link href={publicPostUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" /> View Live Post
              </Button>
            </Link>
        </div>
      </div>
      {/* Form for Post Metadata (title, slug, excerpt, etc.) */}
      <PostForm
        post={postWithBlocks}
        formAction={updatePostWithId}
        actionButtonText="Update Post Metadata"
        isEditing={true}
      />
      <Separator className="my-8" />
      {/* Area for managing content blocks */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Post Content Blocks</h2>
        <BlockEditorArea
          parentId={postWithBlocks.id}
          parentType="post" // Specify parentType as 'post'
          initialBlocks={postWithBlocks.blocks}
          languageId={postWithBlocks.language_id} // Pass current post's language ID
        />
      </div>
    </div>
  );
}
