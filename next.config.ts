import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-a31e3f1a87d144898aeb489a8221f92e.r2.dev',
      },
      // Add other necessary hostnames, for example, from NEXT_PUBLIC_URL if it's different
      // and used for images. This example assumes NEXT_PUBLIC_R2_BASE_URL's hostname is the one above.
      // If NEXT_PUBLIC_URL is also an image source and has a different hostname:
      ...(process.env.NEXT_PUBLIC_URL
        ? [
            {
              protocol: new URL(process.env.NEXT_PUBLIC_URL).protocol.slice(0, -1) as 'http' | 'https',
              hostname: new URL(process.env.NEXT_PUBLIC_URL).hostname,
            },
          ]
        : []),
    ],
  },
experimental: {
    optimizeCss: true,
    cssChunking: 'strict',
  },
  turbopack: {
    // Turbopack-specific options can be placed here if needed in the future
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  }
};

let configToExport = nextConfig;
if (process.env.ANALYZE === 'true') {
  configToExport = withBundleAnalyzer(nextConfig);
}

export default configToExport;
