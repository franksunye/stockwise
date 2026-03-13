import type { MetadataRoute } from "next";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { getAllArticles } from "@/lib/learn-content";
import { getAllSupportArticles } from "@/lib/support-content";

function nowIso() {
  return new Date().toISOString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brandCoreZhCN.domain;
  const updated = nowIso();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: updated, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/about`, lastModified: updated, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/pricing`, lastModified: updated, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/learn`, lastModified: updated, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/support`, lastModified: updated, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refund`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
  ];

  const learnRoutes = (await getAllArticles()).map((article) => ({
    url: `${base}/learn/${article.slug}`,
    lastModified: article.date || updated,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const supportRoutes = getAllSupportArticles().map((article) => ({
    url: `${base}/support/${article.slug}`,
    lastModified: article.lastUpdated || updated,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...learnRoutes, ...supportRoutes];
}
