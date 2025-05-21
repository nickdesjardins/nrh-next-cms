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
}) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return encodedRedirect("error", "/cms/media", "User not authenticated for media record.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    return encodedRedirect("error", "/cms/media", "Forbidden: Insufficient permissions to record media.");
  }

  const mediaData: InsertMediaPayload = {
    uploader_id: user.id,
    file_name: payload.fileName,
    object_key: payload.objectKey,
    file_type: payload.fileType,
    size_bytes: payload.sizeBytes,
    description: payload.description || null,
  };

  const { data: newMedia, error } = await supabase
    .from("media")
    .insert(mediaData)
    .select()
    .single();

  if (error) {
    console.error("Error recording media upload:", error);
    return encodedRedirect("error", "/cms/media", `Failed to record media: ${error.message}`);
  }

  revalidatePath("/cms/media");
  // Instead of returning success, redirect
  encodedRedirect("success", "/cms/media", "Media recorded successfully.");
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

// Type for inserting media
type InsertMediaPayload = Omit<Media, 'id' | 'created_at' | 'updated_at' | 'uploader_id'> & {
    uploader_id: string;
};