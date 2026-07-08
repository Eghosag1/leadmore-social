import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only route indicator overlay ("N" badge, bottom-left) would otherwise
  // bleed into local Puppeteer screenshots of the internal render page —
  // never renders in production builds either way, but hiding it locally
  // keeps local render verification honest.
  devIndicators: false,
  // @tailwindcss/postcss (used at request-time by src/lib/render/compile-tailwind.ts
  // to compile CSS for database-stored templates) pulls in lightningcss, a
  // native addon that loads its .node binary via a dynamic `require(`...${x}.node`)`
  // call Turbopack/webpack can't statically bundle — left as a real Node
  // `require()` at runtime instead, which resolves it correctly.
  serverExternalPackages: ["@tailwindcss/postcss", "lightningcss", "tailwindcss"],
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
