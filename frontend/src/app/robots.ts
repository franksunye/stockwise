import type { MetadataRoute } from "next";

// Use the actual serving domain (www.ziso.cc) to avoid 307 redirect issues.
// Search engines do NOT follow redirects when fetching robots.txt/sitemap targets.
const CANONICAL_ORIGIN = "https://www.ziso.cc";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}

