import fs from 'fs';
import path from 'path';
import { DEFAULT_PUBLIC_LOCALE, type PublicLocale } from '@/lib/public-i18n';

// Define the content directory (relative to project root, which is CWD for Node usually, but Next.js runs in frontend)
// We need to resolve from the frontend directory up to docs
const CONTENT_DIR = path.join(process.cwd(), '..', 'docs', '4_Growth_Ops', 'content');

// Recursive file walker
function walkMarkdownFiles(dirPath: string, allFiles: string[] = []): string[] {
    if (!fs.existsSync(dirPath)) return allFiles;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === '_views' || entry.name === 'archive' || entry.name === 'marketing') continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkMarkdownFiles(fullPath, allFiles);
        } else if (entry.name.endsWith('.md') && entry.name !== 'README.md' && entry.name !== 'STOCKWISE_101_SYLLABUS.md') {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
}

interface ContentRequestOptions {
    locale?: PublicLocale;
    fallbackToDefault?: boolean;
}

export interface ArticleMeta {
    slug: string;
    title: string;
    subtitle: string;
    date: string;
    category: string;
    image?: string;
    image_prompt?: string;
    readingTime: number;
    locale?: PublicLocale;
    sourceLocale?: PublicLocale;
    translationStatus?: 'source' | 'translated' | 'fallback';
    availableLocales?: PublicLocale[];
    isFallback?: boolean;
}

export interface Article extends ArticleMeta {
    content: string;
}

function isPublishableMeta(meta: Partial<ArticleMeta> & { publish?: string }): boolean {
    if (meta.publish && meta.publish.toLowerCase() === 'false') return false;
    return Boolean(meta.title && meta.date && meta.category);
}

// Simple Frontmatter Parser
function parseFrontmatter(fileContent: string): { meta: Partial<ArticleMeta>, content: string } {
    const frontmatterRegex = /---\s*([\s\S]*?)\s*---/;
    const match = frontmatterRegex.exec(fileContent);

    const meta: Record<string, string> = {};
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
        meta: meta as Partial<ArticleMeta>,
        content
    };
}

function getContentDirectory(locale: PublicLocale): string | null {
    const localizedDir = path.join(CONTENT_DIR, locale);
    if (fs.existsSync(localizedDir)) {
        return localizedDir;
    }
    if (locale === DEFAULT_PUBLIC_LOCALE && fs.existsSync(CONTENT_DIR)) {
        return CONTENT_DIR;
    }
    return null;
}

function resolveDirectory(options?: ContentRequestOptions): { dir: string | null; sourceLocale: PublicLocale; isFallback: boolean } {
    const locale = options?.locale || DEFAULT_PUBLIC_LOCALE;
    const localizedDir = getContentDirectory(locale);
    if (localizedDir) {
        return { dir: localizedDir, sourceLocale: locale, isFallback: false };
    }

    if (options?.fallbackToDefault) {
        return {
            dir: getContentDirectory(DEFAULT_PUBLIC_LOCALE),
            sourceLocale: DEFAULT_PUBLIC_LOCALE,
            isFallback: locale !== DEFAULT_PUBLIC_LOCALE,
        };
    }

    return { dir: null, sourceLocale: locale, isFallback: false };
}

export async function getAllArticles(options?: ContentRequestOptions): Promise<ArticleMeta[]> {
    const locale = options?.locale || DEFAULT_PUBLIC_LOCALE;
    const { dir, sourceLocale, isFallback } = resolveDirectory(options);
    if (!dir || !fs.existsSync(dir)) {
        return [];
    }

    const files = walkMarkdownFiles(dir);
    const articles = files
        .map(filePath => {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const { meta } = parseFrontmatter(fileContent);

            if (!isPublishableMeta(meta as Partial<ArticleMeta> & { publish?: string })) {
                return null;
            }

            return {
                slug: path.basename(filePath, '.md'),
                title: meta.title || 'Untitled',
                subtitle: meta.subtitle || '',
                date: meta.date || '',
                category: meta.category || 'Uncategorized',
                image: meta.image,
                image_prompt: meta.image_prompt,
                readingTime: Math.max(1, Math.ceil(fileContent.length / 400)),
                locale,
                sourceLocale,
                translationStatus: isFallback ? 'fallback' : sourceLocale === DEFAULT_PUBLIC_LOCALE ? 'source' : 'translated',
                availableLocales: [sourceLocale],
                isFallback,
            } as ArticleMeta;
        })
        .filter((article): article is ArticleMeta => article !== null)
        .sort((a, b) => (a.slug > b.slug ? 1 : -1));

    return articles;
}

export async function getArticleBySlug(slug: string, options?: ContentRequestOptions): Promise<Article | null> {
    const locale = options?.locale || DEFAULT_PUBLIC_LOCALE;
    const { dir } = resolveDirectory(options);
    if (!dir) {
        return null;
    }

    // Since we now have subdirectories, we must find the file by traversing.
    // For performance, we could search only for `slug.md` but Next.js router gives us the slug.
    const allFiles = walkMarkdownFiles(dir);
    const filePath = allFiles.find(f => path.basename(f, '.md') === slug);

    if (!filePath || !fs.existsSync(filePath)) {
        return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { meta, content } = parseFrontmatter(fileContent);

    if (!isPublishableMeta(meta as Partial<ArticleMeta> & { publish?: string })) {
        return null;
    }

    const { sourceLocale, isFallback } = resolveDirectory(options);

    return {
        slug,
        title: meta.title || 'Untitled',
        subtitle: meta.subtitle || '',
        date: meta.date || '',
        category: meta.category || 'Uncategorized',
        image: meta.image,
        image_prompt: meta.image_prompt,
        content,
        readingTime: Math.max(1, Math.ceil(fileContent.length / 400)),
        locale,
        sourceLocale,
        translationStatus: isFallback ? 'fallback' : sourceLocale === DEFAULT_PUBLIC_LOCALE ? 'source' : 'translated',
        availableLocales: [sourceLocale],
        isFallback,
    };
}

export function getCategories(articles: ArticleMeta[]): string[] {
    const categories = new Set(articles.map(a => a.category));
    return Array.from(categories);
}
