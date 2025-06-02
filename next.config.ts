import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
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
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  }
};

export default nextConfig;
