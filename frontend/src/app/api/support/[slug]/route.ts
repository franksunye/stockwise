import { NextRequest, NextResponse } from "next/server";
import { getArticleBySlug } from "@/lib/support-content";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const article = getArticleBySlug(slug);

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error("Failed to load support article:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
