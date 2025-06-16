// scripts/backfill-image-meta.ts
import { createClient } from '@supabase/supabase-js';
import { s3Client } from '@/lib/cloudflare/r2-client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { Readable } from 'stream';
import { getPlaiceholder } from 'plaiceholder';
import 'dotenv/config';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Helper to convert stream to buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk as Buffer));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function backfillImageMeta() {
  if (!R2_BUCKET_NAME) {
    console.error('R2_BUCKET_NAME environment variable is not set.');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase environment variables are not set.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch media records where width is null
  const { data: mediaItems, error } = await supabase
    .from('media')
    .select('id, object_key')
    .is('width', null);

  if (error) {
    console.error('Error fetching media items:', error);
    return;
  }

  if (!mediaItems || mediaItems.length === 0) {
    console.log('No images to backfill.');
    return;
  }

  console.log(`Found ${mediaItems.length} images to process.`);

  for (const item of mediaItems) {
    try {
      console.log(`Processing item ${item.id} with object key ${item.object_key}...`);

      // 1. Download the image from R2
      const getObjectParams = {
        Bucket: R2_BUCKET_NAME,
        Key: item.object_key,
      };
      const getObjectResponse = await s3Client.send(new GetObjectCommand(getObjectParams));

      if (!getObjectResponse.Body) {
        throw new Error('Failed to retrieve image from R2: Empty body.');
      }

      const imageBuffer = await streamToBuffer(getObjectResponse.Body as Readable);

      // 2. Extract metadata using sharp and plaiceholder
      const sharpInstance = sharp(imageBuffer);
      const metadata = await sharpInstance.metadata();
      const { base64: blurDataURL } = await getPlaiceholder(imageBuffer, { size: 10 });

      const { width, height } = metadata;

      if (!width || !height) {
        console.warn(`Could not extract width/height for ${item.object_key}. Skipping.`);
        continue;
      }

      // 3. Update the record in the media table
      const { error: updateError } = await supabase
        .from('media')
        .update({
          width,
          height,
          blur_data_url: blurDataURL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      if (updateError) {
        console.error(`Failed to update item ${item.id}:`, updateError);
      } else {
        console.log(`Successfully updated item ${item.id}.`);
      }
    } catch (e: any) {
      console.error(`An error occurred while processing item ${item.id}:`, e.message);
    }
  }

  console.log('Backfill complete.');
}

backfillImageMeta();