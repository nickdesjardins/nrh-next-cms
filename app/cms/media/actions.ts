// app/cms/media/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Media } from "@/utils/supabase/types";
import { encodedRedirect } from "@/utils/utils"; // Ensure this is correctly imported

// --- recordMediaUpload and updateMediaItem functions to be updated similarly ---

export async function recordMediaUpload(payload: {
  fileName: string;
  objectKey: string;
  fileType: string;
  sizeBytes: number;
  description?: string;
  width?: number; // Added width
  height?: number; // Added height
}, returnJustData?: boolean): Promise<{ success: true; data: Media } | { error: string } | void>  {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    if (returnJustData) return { error: "User not authenticated for media record." };
    return encodedRedirect("error", "/cms/media", "User not authenticated for media record.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    if (returnJustData) return { error: "Forbidden: Insufficient permissions to record media." };
    return encodedRedirect("error", "/cms/media", "Forbidden: Insufficient permissions to record media.");
  }

  const mediaData: InsertMediaPayload = {
    uploader_id: user.id,
    file_name: payload.fileName,
    object_key: payload.objectKey,
    file_type: payload.fileType,
    size_bytes: payload.sizeBytes,
    description: payload.description || null,
    width: payload.width || null, // Added width
    height: payload.height || null, // Added height
  };

  const { data: newMedia, error } = await supabase
    .from("media")
    .insert(mediaData)
    .select()
    .single();

  if (error) {
    console.error("Error recording media upload:", error);
    if (returnJustData) return { error: `Failed to record media: ${error.message}` };
    return encodedRedirect("error", "/cms/media", `Failed to record media: ${error.message}`);
  }

  revalidatePath("/cms/media");
  if (returnJustData) {
    return { success: true, data: newMedia as Media };
  } else {
    encodedRedirect("success", "/cms/media", "Media recorded successfully.");
  }
}


export async function updateMediaItem(mediaId: string, payload: { description?: string; file_name?: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const mediaEditPath = `/cms/media/${mediaId}/edit`;

    if (!user) return encodedRedirect("error", mediaEditPath, "User not authenticated for media update.");

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
        return encodedRedirect("error", mediaEditPath, "Forbidden to update media.");
    }

    const updateData: Partial<Pick<Media, 'description' | 'file_name' | 'updated_at'>> = {};
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.file_name !== undefined) updateData.file_name = payload.file_name;

    if (Object.keys(updateData).length === 0) {
        return encodedRedirect("error", mediaEditPath, "No updatable fields provided for media.");
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from("media")
        .update(updateData)
        .eq("id", mediaId)
        .select()
        .single();

    if (error) {
        console.error("Error updating media item:", error);
        return encodedRedirect("error", mediaEditPath, `Error updating media: ${error.message}`);
    }
    revalidatePath("/cms/media");
    revalidatePath(mediaEditPath);
    encodedRedirect("success", mediaEditPath, "Media item updated successfully.");
}


export async function deleteMediaItem(mediaId: string, objectKey: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return encodedRedirect("error", "/cms/media", "User not authenticated.");
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
        return encodedRedirect("error", "/cms/media", "Forbidden: Insufficient permissions.");
    }

    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Client } = await import("@/lib/cloudflare/r2-client");
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

    if (!R2_BUCKET_NAME) {
      return encodedRedirect("error", "/cms/media", "R2 Bucket not configured for deletion.");
    }

    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: objectKey,
        });
        await s3Client.send(deleteCommand);
    } catch (r2Error: any) {
        console.error("Error deleting from R2:", r2Error);
        // Decide if you want to proceed with DB deletion if R2 deletion fails
        // It's often better to proceed and log, or handle more gracefully.
        // For now, we'll let it proceed to DB deletion but the error is logged.
        // You could redirect with a partial success/warning message here.
    }

    const { error: dbError } = await supabase.from("media").delete().eq("id", mediaId);

    if (dbError) {
        console.error("Error deleting media record from DB:", dbError);
        return encodedRedirect("error", "/cms/media", `Failed to delete media record: ${dbError.message}`);
    }

    revalidatePath("/cms/media");
    encodedRedirect("success", "/cms/media", "Media item deleted successfully.");
}

export async function deleteMultipleMediaItems(items: Array<{ id: string; objectKey: string }>) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "User not authenticated." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    return { error: "Forbidden: Insufficient permissions." };
  }

  if (!items || items.length === 0) {
    return { error: "No items selected for deletion." };
  }

  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3"); // Use DeleteObjects for batch
  const { s3Client } = await import("@/lib/cloudflare/r2-client");
  const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

  if (!R2_BUCKET_NAME) {
    return { error: "R2 Bucket not configured for deletion." };
  }

  const r2ObjectsToDelete = items.map(item => ({ Key: item.objectKey }));
  const itemIdsToDelete = items.map(item => item.id);
  let r2DeletionError = null;
  let dbDeletionError = null;

  // Batch delete from R2
  try {
    if (r2ObjectsToDelete.length > 0) {
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: { Objects: r2ObjectsToDelete },
      });
      const output = await s3Client.send(deleteCommand);
      if (output.Errors && output.Errors.length > 0) {
        console.error("Errors deleting some objects from R2:", output.Errors);
        // Collect specific errors if needed, for now a general message
        r2DeletionError = `Some objects failed to delete from R2: ${output.Errors.map(e => e.Key).join(', ')}`;
      }
    }
  } catch (error: any) {
    console.error("Error batch deleting from R2:", error);
    r2DeletionError = `Failed to delete objects from R2: ${error.message}`;
  }

  // Batch delete from Supabase
  try {
    if (itemIdsToDelete.length > 0) {
      const { error } = await supabase.from("media").delete().in("id", itemIdsToDelete);
      if (error) {
        throw error;
      }
    }
  } catch (error: any) {
    console.error("Error batch deleting media records from DB:", error);
    dbDeletionError = `Failed to delete media records from DB: ${error.message}`;
  }

  if (r2DeletionError || dbDeletionError) {
    // Construct a combined error message
    const errors = [r2DeletionError, dbDeletionError].filter(Boolean).join(" | ");
    // No redirect here, return error object for client-side handling
    return { error: `Deletion process encountered issues: ${errors}` };
  }

  revalidatePath("/cms/media");
  // No redirect here, return success object for client-side handling
  return { success: "Selected media items deleted successfully." };
}


// Type for inserting media
type InsertMediaPayload = Omit<Media, 'id' | 'created_at' | 'updated_at' | 'uploader_id' | 'width' | 'height'> & {
    uploader_id: string;
    width?: number | null; // Added width
    height?: number | null; // Added height
};

export async function getMediaItems(
    page: number = 1,
    limit: number = 50 // Default to 50 items per page
  ): Promise<{ data?: Media[]; error?: string; hasMore?: boolean }> {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "User not authenticated." };
    }

    // Optional: Check user role if only certain roles can view all media
    // const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    // if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    //     return { error: "Forbidden: Insufficient permissions." };
    // }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
        .from("media")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error fetching media items:", error);
        return { error: `Failed to fetch media items: ${error.message}` };
    }

    const hasMore = count ? to < count -1 : false;

    return { data: data as Media[], hasMore };
}