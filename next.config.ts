import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Mock/demo image sources only. Once Supabase Storage + a real CRM are
      // wired up, property photos and rendered posts will be served from
      // the Supabase project's storage domain instead.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
