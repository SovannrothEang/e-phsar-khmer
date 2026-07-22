import { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();
/** @type {import('next').NextConfig} */

const nextConfig: NextConfig = {

   images: {
    formats: ["image/avif","image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [25, 50, 75, 100],
    remotePatterns: [
      { protocol: "https", hostname: "ui-avatars.com/api/" },
      { protocol: "https", hostname: "ui-avatars.com" },
      {
        protocol: 'https',
        hostname: 'images.khmer24.co',
        port: '',          
        pathname: '/**',
      },
    ],
    
  },
};

export default withNextIntl(nextConfig);