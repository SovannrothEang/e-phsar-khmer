import { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// Derive the Supabase Storage host from the env so next/image can optimize
// public bucket URLs. Evaluated at build time (server-side only); the host is
// already visible in <img src> URLs delivered to the browser — no secret leak.
const supabaseHost = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : null;

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [25, 50, 75, 100],
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com" },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
};

export default withNextIntl(nextConfig);
