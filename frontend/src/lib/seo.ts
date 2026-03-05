import type { Metadata } from "next";

export interface SeoInput {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  type?: "website" | "article";
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

export function buildCanonicalUrl(baseUrl: string, path: string): string {
  const normalized = normalizePath(path);
  return `${baseUrl.replace(/\/$/, "")}${normalized}`;
}

export function buildPageMetadata(baseUrl: string, input: SeoInput): Metadata {
  const canonical = buildCanonicalUrl(baseUrl, input.path);
  const ogType = input.type || "website";

  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      type: ogType,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}

