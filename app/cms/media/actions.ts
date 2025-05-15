// app/cms/media/actions.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import type { Media } from "@/utils/supabase/types"; // Your Media type

// Type for inserting media, omitting auto-generated fields
// Ideally, Database['public']['Tables']['media']['Insert']
type InsertMediaPayload = Omit<Media, 'id' | 'created_at' | 'updated_at' | 'uploader_id'> & {
    uploader_id: string; // uploader_id is required
};


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
    return { error: "User not authenticated." };
  }

  // Optional: Role check again, though API route for presigned URL already did one
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    return { error: "Forbidden: Insufficient permissions to record media." };
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
    return { error: `Failed to record media: ${error.message}` };
  }

  revalidatePath("/cms/media"); // Revalidate the media list page
  // Also revalidate any other paths where media might be displayed if necessary

  return { success: true, media: newMedia as Media };
}


export async function updateMediaItem(mediaId: string, payload: { description?: string; file_name?: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
     if (!user) return { error: "User not authenticated." };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
        return { error: "Forbidden." };
    }

    // Add updated_at to the allowed fields for update
    const updateData: Partial<Pick<Media, 'description' | 'file_name' | 'updated_at'>> = {};
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.file_name !== undefined) updateData.file_name = payload.file_name;

    if (Object.keys(updateData).length === 0) {
        return { error: "No updatable fields provided." };
    }
    updateData.updated_at = new Date().toISOString(); // Manually set if not using DB trigger for media table

    const { data, error } = await supabase
        .from("media")
        .update(updateData)
        .eq("id", mediaId)
        .select()
        .single();

    if (error) {
        console.error("Error updating media item:", error);
        return { error: error.message };
    }
    revalidatePath("/cms/media");
    revalidatePath(`/cms/media/${mediaId}/edit`); // If an edit page exists
    return { success: true, media: data as Media };
}


export async function deleteMediaItem(mediaId: string, objectKey: string) {
    const supabase = createClient(); // For DB operation
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: "User not authenticated." };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
        return { error: "Forbidden." };
    }

    // 1. Delete from R2
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const { s3Client } = await import("@/lib/cloudflare/r2-client");
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

    if (!R2_BUCKET_NAME) return { error: "R2 Bucket not configured." };

    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: objectKey,
        });
        await s3Client.send(deleteCommand);
    } catch (r2Error: any) {
        console.error("Error deleting from R2:", r2Error);
        // Decide if you want to proceed with DB deletion if R2 deletion fails
        // return { error: `Failed to delete file from storage: ${r2Error.message}` };
    }

    // 2. Delete from Supabase media table
    const { error: dbError } = await supabase.from("media").delete().eq("id", mediaId);

    if (dbError) {
        console.error("Error deleting media record from DB:", dbError);
        return { error: `Failed to delete media record: ${dbError.message}` };
    }

    revalidatePath("/cms/media");
    return { success: true };
}