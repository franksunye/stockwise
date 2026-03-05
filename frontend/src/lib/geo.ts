export interface SourceRef {
  name: string;
  url?: string;
  accessedAt?: string;
  claimScope?: string;
}

export interface GeoMeta {
  pageTitle: string;
  pageDescription: string;
  pageUrl: string;
  datePublished?: string;
  dateModified?: string;
  sources?: SourceRef[];
}

export function buildArticleJsonLd(meta: GeoMeta): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.pageTitle,
    description: meta.pageDescription,
    mainEntityOfPage: meta.pageUrl,
    datePublished: meta.datePublished,
    dateModified: meta.dateModified || meta.datePublished,
    isAccessibleForFree: true,
  };
}

export function buildFaqJsonLd(
  faqs: Array<{ question: string; answer: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
