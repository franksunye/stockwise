import fs from 'fs';
import path from 'path';
import { DEFAULT_PUBLIC_LOCALE, type PublicLocale } from '@/lib/public-i18n';

const CONTENT_DIR = path.join(process.cwd(), '..', 'docs', '5_Support_Ops', 'content');

// Recursive file walker
function walkMarkdownFiles(dirPath: string, allFiles: string[] = []): string[] {
    if (!fs.existsSync(dirPath)) return allFiles;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'archive') continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkMarkdownFiles(fullPath, allFiles);
        } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
            allFiles.push(fullPath);
        }
    }
    return allFiles;
}

interface ContentRequestOptions {
    locale?: PublicLocale;
    fallbackToDefault?: boolean;
}

export interface SupportArticle {
    slug: string;
    title: string;
    category: string;
    lastUpdated: string;
    content: string;
    relatedSlugs?: string[];
    locale?: PublicLocale;
    sourceLocale?: PublicLocale;
    translationStatus?: 'source' | 'translated' | 'fallback';
    availableLocales?: PublicLocale[];
    isFallback?: boolean;
}

function parseFrontmatter(fileContent: string): { meta: Partial<SupportArticle>, content: string } {
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
                
                // Strip inline comments (e.g., // or #)
                const commentIndex = value.search(/\s(\/\/|#)/);
                if (commentIndex !== -1) {
                    value = value.slice(0, commentIndex).trim();
                }

                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                meta[key] = value;
            }
        });
    }

    return {
        meta: meta as Partial<SupportArticle>,
        content
    };
}

function getContentDirectory(locale: PublicLocale): string | null {
    const localizedDir = path.join(CONTENT_DIR, locale);
    if (fs.existsSync(localizedDir)) {
        return localizedDir;
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

export function getAllSupportArticles(options?: ContentRequestOptions): SupportArticle[] {
    const locale = options?.locale || DEFAULT_PUBLIC_LOCALE;
    const { dir, sourceLocale, isFallback } = resolveDirectory(options);
    if (!dir || !fs.existsSync(dir)) {
        return [];
    }

    const files = walkMarkdownFiles(dir);
    const articles = files
        .map(filePath => {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const { meta, content } = parseFrontmatter(fileContent);

            return {
                slug: path.basename(filePath, '.md'),
                title: meta.title || 'Untitled',
                category: meta.category || 'Uncategorized',
                lastUpdated: meta.lastUpdated || '',
                content,
                locale,
                sourceLocale,
                translationStatus: isFallback ? 'fallback' : sourceLocale === DEFAULT_PUBLIC_LOCALE ? 'source' : 'translated',
                availableLocales: [sourceLocale],
                isFallback,
            } as SupportArticle;
        })
        .sort((a, b) => (a.slug > b.slug ? 1 : -1));

    return articles;
}

export function getSupportArticleBySlug(slug: string, options?: ContentRequestOptions): SupportArticle | undefined {
    const locale = options?.locale || DEFAULT_PUBLIC_LOCALE;
    const { dir } = resolveDirectory(options);
    if (!dir) {
        return undefined;
    }

    const allFiles = walkMarkdownFiles(dir);
    const filePath = allFiles.find(f => path.basename(f, '.md') === slug);

    if (!filePath || !fs.existsSync(filePath)) {
        return undefined;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { meta, content } = parseFrontmatter(fileContent);

    const { sourceLocale, isFallback } = resolveDirectory(options);

    return {
        slug,
        title: meta.title || 'Untitled',
        category: meta.category || 'Uncategorized',
        lastUpdated: meta.lastUpdated || '',
        content,
        locale,
        sourceLocale,
        translationStatus: isFallback ? 'fallback' : sourceLocale === DEFAULT_PUBLIC_LOCALE ? 'source' : 'translated',
        availableLocales: [sourceLocale],
        isFallback,
    } as SupportArticle;
}
