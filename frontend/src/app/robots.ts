import type { MetadataRoute } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
    ],
    sitemap: `${brandCoreZhCN.domain}/sitemap.xml`,
    host: brandCoreZhCN.domain,
  };
}

