// lib/cloudflare/r2-client.ts
import { S3Client } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
// The R2_S3_ENDPOINT might be directly set, or constructed if you prefer.
// Typically it's `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const R2_ENDPOINT = process.env.R2_S3_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
`R2 client environment variables are missing. File uploads will not work.
Needed: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_S3_ENDPOINT (or construct from R2_ACCOUNT_ID)`
    );
  }
  // In a production environment, you might want to throw an error or handle this more strictly.
}

// Ensure region is explicitly set, even if R2 doesn't use it like AWS S3.
// "auto" is a common placeholder for R2.
const s3Client = new S3Client({
  region: process.env.R2_REGION || "auto", // R2 is region-less for the API endpoint, but SDK might require it. 'auto' often works.
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

export { s3Client };