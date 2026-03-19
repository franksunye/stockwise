import re
import os

with open('frontend/src/lib/support-content.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Try to find all articles.
# A pattern to match each article object:
# slug: '...',
# title: '...',
# category: '...',
# lastUpdated: '...',
# content: `...`
# We can use regex to extract

pattern = re.compile(
    r"slug:\s*['\"]([^'\"]+)['\"],\s*"
    r"title:\s*['\"]([^'\"]+)['\"],\s*"
    r"category:\s*['\"]([^'\"]+)['\"],\s*"
    r"lastUpdated:\s*['\"]([^'\"]+)['\"],\s*"
    r"content:\s*`([\s\S]*?)`\n\s*}(,|;)",
    re.MULTILINE
)

matches = pattern.findall(text)

output_dir = 'docs/5_Support_Ops/content'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

print(f"Found {len(matches)} articles.")

for match in matches:
    slug, title, category, last_updated, content, _ = match
    # Clean content
    content = content.strip()
    
    # Generate Frontmatter
    md_content = f"""---
title: "{title}"
category: "{category}"
lastUpdated: "{last_updated}"
---

{content}
"""
    # Write to file
    filepath = os.path.join(output_dir, f"{slug}.md")
    with open(filepath, 'w', encoding='utf-8') as mf:
        mf.write(md_content)
    print(f"Wrote {filepath}")

# Write a replacement file for support-content.ts
replacement_ts = '''import fs from 'fs';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), '..', 'docs', '5_Support_Ops', 'content');

export interface SupportArticle {
    slug: string;
    title: string;
    category: string;
    lastUpdated: string;
    content: string;
    relatedSlugs?: string[];
}

function parseFrontmatter(fileContent: string): { meta: Partial<SupportArticle>, content: string } {
    const frontmatterRegex = /---\\s*([\\s\\S]*?)\\s*---/;
    const match = frontmatterRegex.exec(fileContent);

    const meta: Record<string, string> = {};
    let content = fileContent;

    if (match) {
        const frontmatterBlock = match[1];
        content = fileContent.replace(match[0], '').trim();

        const lines = frontmatterBlock.split('\\n');
        lines.forEach(line => {
            const colIndex = line.indexOf(':');
            if (colIndex !== -1) {
                const key = line.slice(0, colIndex).trim();
                let value = line.slice(colIndex + 1).trim();
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

export function getAllSupportArticles(): SupportArticle[] {
    if (!fs.existsSync(CONTENT_DIR)) {
        return [];
    }

    const files = fs.readdirSync(CONTENT_DIR);
    const articles = files
        .filter(file => file.endsWith('.md'))
        .map(file => {
            const filePath = path.join(CONTENT_DIR, file);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const { meta, content } = parseFrontmatter(fileContent);

            return {
                slug: file.replace('.md', ''),
                title: meta.title || 'Untitled',
                category: meta.category || 'Uncategorized',
                lastUpdated: meta.lastUpdated || '',
                content,
            } as SupportArticle;
        })
        .sort((a, b) => (a.slug > b.slug ? 1 : -1));

    return articles;
}

export function getArticleBySlug(slug: string): SupportArticle | undefined {
    const filePath = path.join(CONTENT_DIR, `${slug}.md`);

    if (!fs.existsSync(filePath)) {
        return undefined;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { meta, content } = parseFrontmatter(fileContent);

    return {
        slug,
        title: meta.title || 'Untitled',
        category: meta.category || 'Uncategorized',
        lastUpdated: meta.lastUpdated || '',
        content,
    } as SupportArticle;
}
'''

with open('frontend/src/lib/support-content.ts', 'w', encoding='utf-8') as tsf:
    tsf.write(replacement_ts)
print("Updated frontend/src/lib/support-content.ts")
