// app/cms/pages/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Page, PageStatus, Language } from "@/utils/supabase/types";
import { v4 as uuidv4 } from 'uuid';
import { encodedRedirect } from "@/utils/utils"; // Ensure this is correctly imported

// --- createPage and updatePage functions remain unchanged ---

export async function createPage(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return encodedRedirect("error", "/cms/pages/new", "User not authenticated.");


  const rawFormData = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    language_id: parseInt(formData.get("language_id") as string, 10),
    status: formData.get("status") as PageStatus,
    meta_title: formData.get("meta_title") as string || null,
    meta_description: formData.get("meta_description") as string || null,
  };

  if (!rawFormData.title || !rawFormData.slug || isNaN(rawFormData.language_id) || !rawFormData.status) {
    return encodedRedirect("error", "/cms/pages/new", "Missing required fields: title, slug, language, or status.");
  }

  const newTranslationGroupId = uuidv4();

  const pageData: UpsertPagePayload = {
    ...rawFormData,
    author_id: user.id,
    translation_group_id: newTranslationGroupId,
  };

  const { data: newPage, error: createError } = await supabase
    .from("pages")
    .insert(pageData)
    .select("id, title, slug, language_id, translation_group_id")
    .single();

  if (createError) {
    console.error("Error creating page:", createError);
    if (createError.code === '23505' && createError.message.includes('pages_language_id_slug_key')) {
        return encodedRedirect("error", "/cms/pages/new", `The slug "${pageData.slug}" already exists for the selected language. Please use a unique slug.`);
    }
    return encodedRedirect("error", "/cms/pages/new", `Failed to create page: ${createError.message}`);
  }

  let successMessage = "Page created successfully.";

  if (newPage) {
    const { data: languages, error: langError } = await supabase
      .from("languages")
      .select("id, code")
      .neq("id", newPage.language_id);

    if (langError) {
      console.error("Error fetching other languages for auto-creation:", langError);
    } else if (languages && languages.length > 0) {
      let placeholderCreations = 0;
      for (const lang of languages) {
        const placeholderSlug = generatePlaceholderSlug(newPage.title, lang.code);
        const placeholderPageData: Omit<UpsertPagePayload, 'author_id'> & {author_id?: string | null} = {
          language_id: lang.id,
          title: `[${lang.code.toUpperCase()}] ${newPage.title}`,
          slug: placeholderSlug,
          status: 'draft',
          meta_title: null,
          meta_description: null,
          translation_group_id: newPage.translation_group_id,
          author_id: user.id,
        };
        const { error: placeholderError } = await supabase.from("pages").insert(placeholderPageData);
        if (placeholderError) {
          console.error(`Error auto-creating page for language ${lang.code} (slug: ${placeholderSlug}):`, placeholderError);
        } else {
          placeholderCreations++;
        }
      }
      if (placeholderCreations > 0) {
        successMessage += ` ${placeholderCreations} placeholder version(s) also created (draft status, please edit their slugs and content).`;
      }
    }
  }

  revalidatePath("/cms/pages");
  if (newPage?.slug) revalidatePath(`/${newPage.slug}`);

  if (newPage?.id) {
    redirect(`/cms/pages/${newPage.id}/edit?success=${encodeURIComponent(successMessage)}`);
  } else {
    redirect(`/cms/pages?success=${encodeURIComponent(successMessage)}`);
  }
}

export async function updatePage(pageId: number, formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const pageEditPath = `/cms/pages/${pageId}/edit`;

  if (!user) return encodedRedirect("error", pageEditPath, "User not authenticated.");

  const { data: existingPage, error: fetchError } = await supabase
    .from("pages")
    .select("translation_group_id, slug")
    .eq("id", pageId)
    .single();

  if (fetchError || !existingPage) {
    return encodedRedirect("error", "/cms/pages", "Original page not found or error fetching it.");
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
     return encodedRedirect("error", pageEditPath, "Missing required fields: title, slug, language, or status.");
  }

  const pageUpdateData: Partial<Omit<UpsertPagePayload, 'translation_group_id' | 'author_id'>> = {
    title: rawFormData.title,
    slug: rawFormData.slug,
    language_id: rawFormData.language_id,
    status: rawFormData.status,
    meta_title: rawFormData.meta_title,
    meta_description: rawFormData.meta_description,
  };

  const { error: updateError } = await supabase
    .from("pages")
    .update(pageUpdateData)
    .eq("id", pageId);

  if (updateError) {
    console.error("Error updating page:", updateError);
     if (updateError.code === '23505' && updateError.message.includes('pages_language_id_slug_key')) {
        return encodedRedirect("error", pageEditPath, `The slug "${pageUpdateData.slug}" already exists for the selected language. Please use a unique slug.`);
    }
    return encodedRedirect("error", pageEditPath, `Failed to update page: ${updateError.message}`);
  }

  revalidatePath("/cms/pages");
  if (existingPage.slug) revalidatePath(`/${existingPage.slug}`);
  if (rawFormData.slug && rawFormData.slug !== existingPage.slug) {
      revalidatePath(`/${rawFormData.slug}`);
  }
  revalidatePath(pageEditPath);
  redirect(`${pageEditPath}?success=Page updated successfully`);
}


export async function deletePage(pageId: number) {
  const supabase = createClient();
  const { data: pageToDelete, error: fetchErr } = await supabase
    .from("pages")
    .select("slug")
    .eq("id", pageId)
    .single();

  if (fetchErr || !pageToDelete) {
    return encodedRedirect("error", "/cms/pages", "Page not found or error fetching details for deletion.");
  }

  const { error } = await supabase.from("pages").delete().eq("id", pageId);

  if (error) {
    console.error("Error deleting page:", error);
    return encodedRedirect("error", "/cms/pages", `Failed to delete page: ${error.message}`);
  }

  revalidatePath("/cms/pages");
  if (pageToDelete.slug) revalidatePath(`/${pageToDelete.slug}`);
  encodedRedirect("success", "/cms/pages", "Page deleted successfully.");
}

// Helper function to generate a unique slug (simple version, needs improvement for production)
// For auto-generated placeholders, to avoid immediate collision before user edits.
function generatePlaceholderSlug(title: string, langCode: string): string {
  const baseSlug = title.toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .substring(0, 50); // Truncate
  return `${baseSlug}-${langCode}-${uuidv4().substring(0, 4)}`;
}

type UpsertPagePayload = {
  language_id: number;
  author_id: string | null;
  title: string;
  slug: string; // Now language-specific
  status: PageStatus;
  meta_title?: string | null;
  meta_description?: string | null;
  translation_group_id: string; // UUID
};