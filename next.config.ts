import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // ─── Image Optimization ───────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflarestorage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        // Google user avatars from Google OAuth
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // ─── Bundle Optimization ─────────────────────────────────────────────────
  experimental: {
    // Tree-shake unused icons from lucide-react (significant bundle reduction)
    optimizePackageImports: ['lucide-react'],
  },

  // ─── Security ────────────────────────────────────────────────────────────
  // Don't expose Next.js version in response headers
  poweredByHeader: false,

  // Admin › Veritabanı Bakımı migration dosyalarını çalışma zamanında diskten okur.
  outputFileTracingIncludes: {
    '/api/admin/db-maintenance': ['./drizzle/**/*'],
  },

  // Strict mode catches potential issues early in development
  reactStrictMode: true,
  turbopack: {},

  // ─── HTTP Security Headers ───────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // API yanıtları kişiye özeldir; ara önbelleklerde saklanmamalı.
        // (Medya uç noktaları kendi private önbellek başlıklarını belirler.)
        source: '/api/((?!r2/|uploads/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
