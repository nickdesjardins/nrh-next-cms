// app/cms/navigation/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { NavigationItem, MenuLocation, Language } from "@/utils/supabase/types";
import { v4 as uuidv4 } from 'uuid';
import { encodedRedirect } from "@/utils/utils";

// Helper to check admin role
async function isAdminUser(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "ADMIN";
}

type UpsertNavigationItemPayload = {
  language_id: number;
  menu_key: MenuLocation;
  label: string;
  url: string;
  parent_id?: number | null;
  order?: number;
  page_id?: number | null;
  translation_group_id: string;
};

// Helper to generate a placeholder label for new translations
function generatePlaceholderLabel(originalLabel: string, langCode: string): string {
  return `[${langCode.toUpperCase()}] ${originalLabel}`;
}


export async function createNavigationItem(formData: FormData) {
  const supabase = createClient();

  if (!(await isAdminUser(supabase))) {
    return { error: "Unauthorized: Admin role required." };
  }

  const fromGroupId = formData.get("from_translation_group_id") as string | null;
  const targetLangIdForTranslation = formData.get("target_language_id_for_translation") as string | null;
  const initialMenuKeyFromParam = formData.get("menu_key_from_param") as MenuLocation | null; // Capture if passed for new translation
  const originalLabelFromParam = formData.get("original_label_from_param") as string | null;


  const rawFormData = {
    label: formData.get("label") as string,
    url: formData.get("url") as string,
    language_id: parseInt(formData.get("language_id") as string, 10),
    menu_key: (initialMenuKeyFromParam || formData.get("menu_key")) as MenuLocation,
    order: parseInt(formData.get("order") as string, 10) || 0,
    parent_id: formData.get("parent_id") && formData.get("parent_id") !== "___NONE___" ? parseInt(formData.get("parent_id") as string, 10) : null,
    page_id: formData.get("page_id") && formData.get("page_id") !== "___NONE___" ? parseInt(formData.get("page_id") as string, 10) : null,
  };

  if (!rawFormData.label || !rawFormData.url || isNaN(rawFormData.language_id) || !rawFormData.menu_key) {
    return { error: "Missing required fields: label, URL, language, or menu key." };
  }

  const translationGroupId = fromGroupId || uuidv4();

  const navData: UpsertNavigationItemPayload = {
    ...rawFormData,
    translation_group_id: translationGroupId,
  };

  const { data: newNavItem, error } = await supabase
    .from("navigation_items")
    .insert(navData)
    .select()
    .single();

  if (error) {
    console.error("Error creating navigation item:", error);
    return { error: `Failed to create item: ${error.message}` };
  }

  let successMessage = "Navigation item created successfully.";

  if (newNavItem && !fromGroupId && !targetLangIdForTranslation) {
    const { data: languages, error: langError } = await supabase
      .from("languages")
      .select("id, code")
      .neq("id", newNavItem.language_id); 

    if (langError) {
      console.error("Error fetching other languages for nav item auto-creation:", langError);
    } else if (languages && languages.length > 0) {
      let placeholderCreations = 0;
      for (const lang of languages) {
        const placeholderNavItemData: UpsertNavigationItemPayload = {
          language_id: lang.id,
          menu_key: newNavItem.menu_key,
          label: generatePlaceholderLabel(newNavItem.label, lang.code),
          url: '#', 
          parent_id: null, 
          order: newNavItem.order, 
          page_id: null,
          translation_group_id: newNavItem.translation_group_id, 
        };
        const { error: placeholderError } = await supabase.from("navigation_items").insert(placeholderNavItemData);
        if (placeholderError) {
          console.error(`Error auto-creating nav item for language ${lang.code}:`, placeholderError);
        } else {
          placeholderCreations++;
        }
      }
      if (placeholderCreations > 0) {
        successMessage += ` ${placeholderCreations} placeholder version(s) also created (please edit their details).`;
      }
    }
  }


  revalidatePath("/cms/navigation");
  if (newNavItem?.id) {
    revalidatePath(`/cms/navigation/${newNavItem.id}/edit`);
    redirect(`/cms/navigation/${newNavItem.id}/edit?success=${encodeURIComponent(successMessage)}`);
  } else {
    redirect(`/cms/navigation?success=${encodeURIComponent(successMessage)}`);
  }
}

export async function updateNavigationItem(itemId: number, formData: FormData) {
  const supabase = createClient();

  if (!(await isAdminUser(supabase))) {
    return { error: "Unauthorized: Admin role required." };
  }
  const { data: existingItem, error: fetchError } = await supabase
    .from("navigation_items")
    .select("translation_group_id, language_id")
    .eq("id", itemId)
    .single();

  if (fetchError || !existingItem) {
    return { error: "Original navigation item not found or error fetching it." };
  }

  const rawFormData = {
    label: formData.get("label") as string,
    url: formData.get("url") as string,
    language_id: parseInt(formData.get("language_id") as string, 10),
    menu_key: formData.get("menu_key") as MenuLocation,
    order: parseInt(formData.get("order") as string, 10) || 0,
    parent_id: formData.get("parent_id") && formData.get("parent_id") !== "___NONE___" ? parseInt(formData.get("parent_id") as string, 10) : null,
    page_id: formData.get("page_id") && formData.get("page_id") !== "___NONE___" ? parseInt(formData.get("page_id") as string, 10) : null,
  };

   if (!rawFormData.label || !rawFormData.url || isNaN(rawFormData.language_id) || !rawFormData.menu_key) {
     return { error: "Missing required fields: label, URL, language, or menu key." };
  }

  if (rawFormData.language_id !== existingItem.language_id) {
      return { error: "Changing the language of an existing navigation item version is not allowed. Create a new translation instead." };
  }

  const navData: Partial<Omit<UpsertNavigationItemPayload, 'translation_group_id'>> = {
    ...rawFormData,
  };

  const { error } = await supabase
    .from("navigation_items")
    .update(navData)
    .eq("id", itemId);

  if (error) {
    console.error("Error updating navigation item:", error);
    return { error: `Failed to update item: ${error.message}` };
  }

  revalidatePath("/cms/navigation");
  revalidatePath(`/cms/navigation/${itemId}/edit`);
  redirect(`/cms/navigation/${itemId}/edit?success=Item updated successfully`);
}

export async function deleteNavigationItem(itemId: number) {
  const supabase = createClient();

  if (!(await isAdminUser(supabase))) {
    // Not returning an object here for DropdownMenuItem form action
    // It relies on redirect or throwing an error.
    // For client components calling this directly, an error object would be better.
    // Consider how this action is called.
    console.error("Unauthorized delete attempt for nav item:", itemId);
    return { error: "Unauthorized: Admin role required." };
  }

  const { error } = await supabase
    .from("navigation_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("Error deleting navigation item:", error);
    return { error: `Failed to delete item: ${error.message}` };
  }

  revalidatePath("/cms/navigation");
  redirect("/cms/navigation?success=Item deleted successfully");
}


export async function updateNavigationStructureBatch(
  itemsToUpdate: Array<{ id: number; order: number; parent_id: number | null; }>
) {
  const supabase = createClient();
  if (!(await isAdminUser(supabase))) {
    return { error: "Unauthorized: Admin role required for batch update." };
  }

  if (!itemsToUpdate || itemsToUpdate.length === 0) {
    return { error: "No items provided for update." };
  }

  // Supabase JS v2 doesn't have built-in transactions for multiple upserts like this directly.
  // You'd typically loop and perform individual updates.
  // If one fails, others might have succeeded. Consider rollback strategy if needed (more complex).
  let CmsNavigationListPageFailedUpdates = 0;
  for (const item of itemsToUpdate) {
    const { error } = await supabase
      .from("navigation_items")
      .update({
        order: item.order,
        parent_id: item.parent_id,
        updated_at: new Date().toISOString(), // Also update updated_at
      })
      .eq("id", item.id);

    if (error) {
      console.error(`Error updating nav item ${item.id}:`, error.message);
      CmsNavigationListPageFailedUpdates++;
    }
  }

  if (CmsNavigationListPageFailedUpdates > 0) {
    return { error: `Failed to update ${CmsNavigationListPageFailedUpdates} item(s). Some changes might not have been saved.` };
  }

  revalidatePath("/cms/navigation");
  // No redirect needed here, as this is likely called via client-side transition
  return { success: true, message: "Navigation structure updated." };
}


// Fetches navigation items for a specific menu and language (used by public site Header/Footer)
export async function getNavigationMenu(menuKey: MenuLocation, languageCode: string): Promise<NavigationItem[]> {
  const supabase = createClient(); // server client

  const { data: language, error: langError } = await supabase
    .from("languages")
    .select("id")
    .eq("code", languageCode)
    .single();

  if (langError || !language) {
    console.error(`Error fetching language ID for code ${languageCode} in getNavigationMenu:`, langError);
    return [];
  }

  const languageId = language.id;

  const { data: items, error: itemsError } = await supabase
    .from("navigation_items")
    .select("*, pages(slug)") // Select all fields, including translation_group_id and linked page slug
    .eq("menu_key", menuKey)
    .eq("language_id", languageId)
    .order("parent_id", { nullsFirst: true })
    .order("order");

  if (itemsError) {
    console.error(`Error fetching navigation items for ${menuKey} (${languageCode}):`, itemsError);
    return [];
  }
  // @ts-ignore
  return (items || []).map(item => ({...item, id: Number(item.id)}));
}