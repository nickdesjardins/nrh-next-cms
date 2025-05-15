// app/api/upload/presigned-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server"; // Server client for auth
import { s3Client } from "@/lib/cloudflare/r2-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames/keys

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check user role - only WRITER or ADMIN can upload
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "WRITER"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
  }

  if (!R2_BUCKET_NAME) {
    console.error("R2_BUCKET_NAME is not set.");
    return NextResponse.json({ error: "Server configuration error for file uploads." }, { status: 500 });
  }

  try {
    const { filename, contentType, size } = await request.json();

    if (!filename || !contentType || !size) {
      return NextResponse.json({ error: "Missing filename, contentType, or size" }, { status: 400 });
    }

    // Basic validation (you can enhance this)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File size exceeds limit of ${MAX_FILE_SIZE / (1024*1024)}MB.` }, { status: 400 });
    }
    // Add content type validation if needed

    const fileExtension = filename.split('.').pop();
    const uniqueKey = `uploads/${uuidv4()}${fileExtension ? '.' + fileExtension : ''}`; // Store in an 'uploads' folder

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: uniqueKey,
      ContentType: contentType,
      // ACL: 'public-read', // R2 objects are private by default unless bucket is public or presigned URL for GET is used
                           // For direct PUT, ACL is not typically set this way with R2. Permissions are on bucket/token.
      Metadata: { // Optional: add any metadata
        'uploader-user-id': user.id,
      }
    });

    const expiresIn = 300; // 5 minutes
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    return NextResponse.json({
      presignedUrl,
      objectKey: uniqueKey, // Send back the key for the client to use when creating the media record
      method: "PUT",
    });

  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    return NextResponse.json({ error: "Failed to generate upload URL." }, { status: 500 });
  }
}