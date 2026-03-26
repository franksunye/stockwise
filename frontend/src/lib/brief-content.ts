import type { BriefData } from '@/lib/brief-client';

export function extractBriefSectionForSymbol(
    content: string,
    symbol: string
): string | null {
    const safeSymbol = symbol.trim();
    if (!content || !safeSymbol) {
        return null;
    }

    const stockHeaderPattern = new RegExp(
        `### [^\\n]*\\(${safeSymbol}(?:\\.HK|\\.SZ|\\.SH)?\\)([\\s\\S]*?)(?=\\n### [^\\n]+\\([A-Z0-9]{5,6}\\)|\\n---\\n|$)`,
        'i'
    );
    const match = content.match(stockHeaderPattern);
    if (match) {
        return match[0].trim();
    }

    const sections = content.split(/(?=\n### [^\n]+\([A-Z0-9]+\))/);
    const fallbackMatch = sections.find(section => section.includes(`(${safeSymbol})`));
    if (!fallbackMatch) {
        return null;
    }

    const footerIndex = fallbackMatch.indexOf('\n---');
    return footerIndex !== -1
        ? fallbackMatch.substring(0, footerIndex).trim()
        : fallbackMatch.trim();
}

export function getBriefPublishedAt(brief: Pick<BriefData, 'content' | 'created_at'>): string {
    const match = brief.content.match(/(ZISO|StockWise) AI 生成于\s*(\d{1,2}:\d{2})/);
    if (match) {
        return match[2];
    }

    if (brief.created_at) {
        return new Date(brief.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Shanghai',
        });
    }

    return '--:--';
}
