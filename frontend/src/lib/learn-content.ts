import fs from 'fs';
import path from 'path';

// Define the content directory (relative to project root, which is CWD for Node usually, but Next.js runs in frontend)
// We need to resolve from the frontend directory up to docs
const CONTENT_DIR = path.join(process.cwd(), '..', 'docs', 'content');

export interface ArticleMeta {
    slug: string;
    title: string;
    subtitle?: string;
    date: string;
    category: string;
    image_prompt?: string;
}

export interface Article extends ArticleMeta {
    content: string;
}

// Simple Frontmatter Parser
function parseFrontmatter(fileContent: string): { meta: Omit<ArticleMeta, 'slug'>, content: string } {
    const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
    const match = frontmatterRegex.exec(fileContent);

    const meta: any = {};
    let content = fileContent;

    if (match) {
        const frontmatterBlock = match[1];
        content = fileContent.replace(match[0], '').trim();

        const lines = frontmatterBlock.split('\n');
        lines.forEach(line => {
            const colIndex = line.indexOf(':');
            if (colIndex !== -1) {
                const key = line.slice(0, colIndex).trim();
                let value = line.slice(colIndex + 1).trim();
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                meta[key] = value;
            }
        });
    }

    return {
        meta: meta as Omit<ArticleMeta, 'slug'>,
        content
    };
}

export async function getAllArticles(): Promise<ArticleMeta[]> {
    if (!fs.existsSync(CONTENT_DIR)) {
        return [];
    }

    const files = fs.readdirSync(CONTENT_DIR);
    const articles = files
        .filter(file => file.endsWith('.md') && file !== 'STOCKWISE_101_SYLLABUS.md')
        .map(file => {
            const filePath = path.join(CONTENT_DIR, file);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const { meta } = parseFrontmatter(fileContent);

            return {
                slug: file.replace('.md', ''),
                ...meta
            };
        })
        .sort((a, b) => (a.slug > b.slug ? 1 : -1)); // Sort by slug (which contains number like 101-01) for correct order

    return articles;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
    const filePath = path.join(CONTENT_DIR, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { meta, content } = parseFrontmatter(fileContent);

    return {
        slug,
        ...meta,
        content
    };
}

export function getCategories(articles: ArticleMeta[]): string[] {
    const categories = new Set(articles.map(a => a.category));
    return Array.from(categories);
}
