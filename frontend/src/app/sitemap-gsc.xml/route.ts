import type { MetadataRoute } from "next";
import sitemap from "../sitemap";

export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastModified(value: NonNullable<MetadataRoute.Sitemap[number]["lastModified"]>): string {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return value;
}

function serializeSitemap(entries: MetadataRoute.Sitemap): string {
  const urls = entries
    .map((entry) => {
      const fields = [
        `<loc>${escapeXml(entry.url)}</loc>`,
        entry.lastModified ? `<lastmod>${escapeXml(formatLastModified(entry.lastModified))}</lastmod>` : "",
        entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : "",
        typeof entry.priority === "number" ? `<priority>${entry.priority}</priority>` : "",
      ].filter(Boolean);

      return `<url>\n${fields.join("\n")}\n</url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function GET() {
  const entries = await sitemap();

  return new Response(serializeSitemap(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
