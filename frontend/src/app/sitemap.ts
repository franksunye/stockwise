import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/learn-content";
import { getAllSupportArticles } from "@/lib/support-content";

function nowIso() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr: string, fallback: string): string {
  if (!dateStr) return fallback;
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : fallback;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Keep sitemap URLs on the root marketing host so public SEO tests and
  // canonical public-page expectations stay aligned with release policy.
  const base = "https://ziso.cc";
  const updated = nowIso();

  // 1. Static Routes for all 4 locales
  const locales = ["", "/cn", "/ko", "/es"] as const;
  const staticPages = ["", "/about", "/pricing", "/privacy", "/terms", "/refund"] as const;

  const staticRoutes: MetadataRoute.Sitemap = [];

  locales.forEach((localePrefix) => {
    staticPages.forEach((page) => {
      const isRoot = localePrefix === "" && page === "";
      const isEnglishRoot = localePrefix === "" && page !== "";
      
      staticRoutes.push({
        url: `${base}${localePrefix}${page}`,
        lastModified: updated,
        changeFrequency: (page === "" || page === "/pricing" || page === "/about") ? "daily" : "monthly",
        priority: isRoot ? 1.0 : (isEnglishRoot || page === "/pricing" || page === "/about") ? 0.9 : 0.6,
      });
    });
  });

  // 2. Content roots: English on root, Chinese under /cn
  const contentRoots = ["/learn", "/support"] as const;
  contentRoots.forEach((root) => {
    staticRoutes.push({
      url: `${base}${root}`,
      lastModified: updated,
      changeFrequency: "daily",
      priority: 0.8,
    });
    staticRoutes.push({
      url: `${base}/cn${root}`,
      lastModified: updated,
      changeFrequency: "daily",
      priority: 0.8,
    });
  });

  // 3. Dynamic English + Chinese Article Routes
  const enArticles = await getAllArticles({ locale: "en" });
  const enLearnRoutes = enArticles.map((article) => ({
    url: `${base}/learn/${article.slug}`,
    lastModified: formatDate(article.date, updated),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const cnArticles = await getAllArticles({ locale: "cn" });
  const cnLearnRoutes = cnArticles.map((article) => ({
    url: `${base}/cn/learn/${article.slug}`,
    lastModified: formatDate(article.date, updated),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const enSupportArticles = getAllSupportArticles({ locale: "en" });
  const enSupportRoutes = enSupportArticles.map((article) => ({
    url: `${base}/support/${article.slug}`,
    lastModified: formatDate(article.lastUpdated, updated),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const cnSupportArticles = getAllSupportArticles({ locale: "cn" });
  const cnSupportRoutes = cnSupportArticles.map((article) => ({
    url: `${base}/cn/support/${article.slug}`,
    lastModified: formatDate(article.lastUpdated, updated),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  /** Locale-neutral app tools surfaced on apex host (canonical = /tools/...). */
  const toolRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/tools/position-budget`,
      lastModified: updated,
      changeFrequency: "weekly",
      priority: 0.75,
    },
  ];

  return [
    ...staticRoutes,
    ...enLearnRoutes,
    ...cnLearnRoutes,
    ...enSupportRoutes,
    ...cnSupportRoutes,
    ...toolRoutes,
  ];
}
