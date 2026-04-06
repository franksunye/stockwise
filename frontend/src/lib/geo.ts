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
  image?: string;
  sources?: SourceRef[];
}

export function buildArticleJsonLd(meta: GeoMeta): Record<string, unknown> {
  const DEFAULT_IMAGE = `${meta.pageUrl.startsWith('http') ? new URL(meta.pageUrl).origin : 'https://ziso.cc'}/icon.png`;
  const imageUrl = meta.image ? (meta.image.startsWith('http') ? meta.image : `${meta.pageUrl.startsWith('http') ? new URL(meta.pageUrl).origin : 'https://ziso.cc'}${meta.image.startsWith('/') ? '' : '/'}${meta.image}`) : DEFAULT_IMAGE;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.pageTitle,
    description: meta.pageDescription,
    image: imageUrl,
    author: {
      "@type": "Organization",
      name: "ZISO AI"
    },
    publisher: {
      "@type": "Organization",
      name: "ZISO AI",
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_IMAGE
      }
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": meta.pageUrl
    },
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
