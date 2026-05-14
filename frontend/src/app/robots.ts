import type { MetadataRoute } from "next";

// Keep robots/sitemap on the root marketing host to match the public SEO policy.
const CANONICAL_ORIGIN = "https://ziso.cc";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: [
      `${CANONICAL_ORIGIN}/sitemap.xml`,
      `${CANONICAL_ORIGIN}/sitemap-gsc.xml`,
    ],
    host: CANONICAL_ORIGIN,
  };
}
