// app/cms/posts/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Post, PageStatus, Language } from "@/utils/supabase/types";

type UpsertPostPayload = {
  language_id: number;
  author_id: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  status: PageStatus;
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
};

export async function createPost(formData: FormData) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "User not authenticated." };
  }

  const rawFormData = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    language_id: parseInt(formData.get("language_id") as string, 10),
    status: formData.get("status") as PageStatus,
    excerpt: formData.get("excerpt") as string || null,
    published_at: formData.get("published_at") as string || null,
    meta_title: formData.get("meta_title") as string || null,
    meta_description: formData.get("meta_description") as string || null,
  };

  if (!rawFormData.title || !rawFormData.slug || isNaN(rawFormData.language_id) || !rawFormData.status) {
    return { error: "Missing required fields: title, slug, language, or status." };
  }

  let publishedAtISO: string | null = null;
  if (rawFormData.published_at) {
    const parsedDate = new Date(rawFormData.published_at);
    if (!isNaN(parsedDate.getTime())) {
      publishedAtISO = parsedDate.toISOString();
    } else {
      publishedAtISO = rawFormData.published_at;
    }
  }

  const postData: UpsertPostPayload = {
    ...rawFormData,
    published_at: publishedAtISO,
    author_id: user.id,
  };

  const { data: newPost, error: createError } = await supabase
    .from("posts")
    .insert(postData)
    .select()
    .single();

  if (createError) {
    console.error("Error creating post:", createError);
    return { error: `Failed to create post: ${createError.message}` };
  }

  let successMessage = "Post created successfully.";

  // --- Auto-create localized versions ---
  if (newPost) {
    const { data: languages, error: langError } = await supabase
      .from("languages")
      .select("id, code")
      .neq("id", newPost.language_id);

    if (langError) {
      console.error("Error fetching other languages for post auto-creation:", langError);
    } else if (languages && languages.length > 0) {
      let placeholderCreations = 0;
      for (const lang of languages) {
        const placeholderPostData: UpsertPostPayload = {
          ...postData, // Use original data as a base
          language_id: lang.id,
          title: `[${lang.code.toUpperCase()}] ${newPost.title}`,
          status: 'draft',
          published_at: null, // Drafts shouldn't have a publish date set yet
          excerpt: `[${lang.code.toUpperCase()}] ${newPost.excerpt || ''}`,
          meta_title: null,
          meta_description: null,
        };
        const { error: placeholderError } = await supabase
          .from("posts")
          .insert(placeholderPostData);

        if (placeholderError) {
          console.error(`Error auto-creating post for language ${lang.code}:`, placeholderError);
        } else {
          placeholderCreations++;
        }
      }
      if (placeholderCreations > 0) {
        successMessage += ` ${placeholderCreations} placeholder version(s) also created.`;
      }
    }
  }
  // --- End auto-create ---

  revalidatePath("/cms/posts");
  if (newPost?.id) {
    revalidatePath(`/cms/posts/${newPost.id}/edit`);
    redirect(`/cms/posts/${newPost.id}/edit?success=${encodeURIComponent(successMessage)}`);
  } else {
    redirect(`/cms/posts?success=${encodeURIComponent(successMessage)}`);
  }
}

// updatePost and deletePost actions remain the same
export async function updatePost(postId: number, formData: FormData) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "User not authenticated." };
  }

  const rawFormData = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    language_id: parseInt(formData.get("language_id") as string, 10),
    status: formData.get("status") as PageStatus,
    excerpt: formData.get("excerpt") as string || null,
    published_at: formData.get("published_at") as string || null,
    meta_title: formData.get("meta_title") as string || null,
    meta_description: formData.get("meta_description") as string || null,
  };

  if (!rawFormData.title || !rawFormData.slug || isNaN(rawFormData.language_id) || !rawFormData.status) {
     return { error: "Missing required fields: title, slug, language, or status." };
  }

  let publishedAtISO: string | null = null;
  if (rawFormData.published_at) {
    const parsedDate = new Date(rawFormData.published_at);
    if (!isNaN(parsedDate.getTime())) {
      publishedAtISO = parsedDate.toISOString();
    } else {
      publishedAtISO = rawFormData.published_at;
    }
  }

  const postUpdateData: Partial<UpsertPostPayload> = {
    title: rawFormData.title,
    slug: rawFormData.slug,
    language_id: rawFormData.language_id,
    excerpt: rawFormData.excerpt,
    status: rawFormData.status,
    published_at: publishedAtISO,
    meta_title: rawFormData.meta_title,
    meta_description: rawFormData.meta_description,
  };

  const { error } = await supabase
    .from("posts")
    .update(postUpdateData)
    .eq("id", postId);

  if (error) {
    console.error("Error updating post:", error);
    return { error: `Failed to update post: ${error.message}` };
  }

  revalidatePath("/cms/posts");
  revalidatePath(`/cms/posts/${postId}/edit`);
  redirect(`/cms/posts/${postId}/edit?success=Post updated successfully`);
}

export async function deletePost(postId: number) {
  const supabase = createClient();

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);

  if (error) {
    console.error("Error deleting post:", error);
    return { error: `Failed to delete post: ${error.message}` };
  }

  revalidatePath("/cms/posts");
  redirect("/cms/posts?success=Post deleted successfully");
}
