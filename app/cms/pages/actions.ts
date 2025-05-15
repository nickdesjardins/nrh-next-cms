// app/cms/pages/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Page, PageStatus, Language } from "@/utils/supabase/types";

type UpsertPagePayload = {
  language_id: number;
  author_id: string | null;
  title: string;
  slug: string;
  status: PageStatus;
  meta_title?: string | null;
  meta_description?: string | null;
};

export async function createPage(formData: FormData) {
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
    meta_title: formData.get("meta_title") as string || null,
    meta_description: formData.get("meta_description") as string || null,
  };

  if (!rawFormData.title || !rawFormData.slug || isNaN(rawFormData.language_id) || !rawFormData.status) {
    return { error: "Missing required fields: title, slug, language, or status." };
  }

  const pageData: UpsertPagePayload = {
    ...rawFormData,
    author_id: user.id,
  };

  const { data: newPage, error: createError } = await supabase
    .from("pages")
    .insert(pageData)
    .select()
    .single();

  if (createError) {
    console.error("Error creating page:", createError);
    return { error: `Failed to create page: ${createError.message}` };
  }

  let successMessage = "Page created successfully.";

  // --- Auto-create localized versions ---
  if (newPage) {
    const { data: languages, error: langError } = await supabase
      .from("languages")
      .select("id, code")
      .neq("id", newPage.language_id); // Get other active languages

    if (langError) {
      console.error("Error fetching other languages for auto-creation:", langError);
      // Proceed without auto-creating if languages can't be fetched
    } else if (languages && languages.length > 0) {
      let placeholderCreations = 0;
      for (const lang of languages) {
        const placeholderPageData: UpsertPagePayload = {
          ...pageData, // Use original data as a base
          language_id: lang.id,
          title: `[${lang.code.toUpperCase()}] ${newPage.title}`, // Placeholder title
          status: 'draft', // Always create placeholders as drafts
          meta_title: null, // Clear SEO fields for placeholders
          meta_description: null,
          // slug can remain the same as it's unique per language_id
        };
        const { error: placeholderError } = await supabase
          .from("pages")
          .insert(placeholderPageData);

        if (placeholderError) {
          console.error(`Error auto-creating page for language ${lang.code}:`, placeholderError);
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

  revalidatePath("/cms/pages");
  if (newPage?.id) {
    revalidatePath(`/cms/pages/${newPage.id}/edit`);
    redirect(`/cms/pages/${newPage.id}/edit?success=${encodeURIComponent(successMessage)}`);
  } else {
    redirect(`/cms/pages?success=${encodeURIComponent(successMessage)}`);
  }
}

// updatePage and deletePage actions remain the same as before
export async function updatePage(pageId: number, formData: FormData) {
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
    meta_title: formData.get("meta_title") as string || null,
    meta_description: formData.get("meta_description") as string || null,
  };

  if (!rawFormData.title || !rawFormData.slug || isNaN(rawFormData.language_id) || !rawFormData.status) {
     return { error: "Missing required fields: title, slug, language, or status." };
  }

  const pageUpdateData: Partial<UpsertPagePayload> = {
    title: rawFormData.title,
    slug: rawFormData.slug,
    language_id: rawFormData.language_id,
    status: rawFormData.status,
    meta_title: rawFormData.meta_title,
    meta_description: rawFormData.meta_description,
  };

  const { error } = await supabase
    .from("pages")
    .update(pageUpdateData)
    .eq("id", pageId);

  if (error) {
    console.error("Error updating page:", error);
    return { error: `Failed to update page: ${error.message}` };
  }

  revalidatePath("/cms/pages");
  revalidatePath(`/cms/pages/${pageId}/edit`);
  redirect(`/cms/pages/${pageId}/edit?success=Page updated successfully`);
}

export async function deletePage(pageId: number) {
  const supabase = createClient();

  const { error } = await supabase
    .from("pages")
    .delete()
    .eq("id", pageId);

  if (error) {
    console.error("Error deleting page:", error);
    return { error: `Failed to delete page: ${error.message}` };
  }

  revalidatePath("/cms/pages");
  redirect("/cms/pages?success=Page deleted successfully");
}
