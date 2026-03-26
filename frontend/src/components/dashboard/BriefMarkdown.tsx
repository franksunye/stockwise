'use client';

import ReactMarkdown from 'react-markdown';
import type { ReactNode } from 'react';

type BriefMarkdownVariant = 'drawer' | 'page';

function stripGeneratedAt(content: string): string {
    return content.replace(/(ZISO|StockWise) AI 生成于\s*\d{1,2}:\d{2}/g, '').trim();
}

export function BriefMarkdown({
    content,
    variant,
}: {
    content: string;
    variant: BriefMarkdownVariant;
}) {
    if (variant === 'drawer') {
        return (
            <ReactMarkdown
                components={{
                    h1: ({ children }) => <h3 className="text-lg font-black text-white mt-8 mb-4 tracking-tight uppercase italic">{children}</h3>,
                    h2: ({ children }) => <h4 className="text-base font-bold text-slate-200 mt-6 mb-3">{children}</h4>,
                    h3: ({ children }) => (
                        <h5 className="text-base font-black text-indigo-400 mt-6 mb-3 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            {children}
                        </h5>
                    ),
                    p: ({ children }) => <p className="text-sm text-slate-400 leading-relaxed mb-4 text-justify">{children}</p>,
                    ul: ({ children }) => <ul className="space-y-2 mb-4 list-disc pl-4 marker:text-indigo-500/50">{children}</ul>,
                    li: ({ children }) => <li className="text-sm text-slate-400 pl-1">{children}</li>,
                    strong: ({ children }) => <span className="text-indigo-200 font-bold">{children}</span>,
                    hr: () => <hr className="border-white/5 my-8" />,
                }}
            >
                {stripGeneratedAt(content)}
            </ReactMarkdown>
        );
    }

    return (
        <ReactMarkdown
            components={{
                h1: ({ children }) => <h3 className="text-lg font-black text-white mt-8 mb-4 tracking-tight">{children}</h3>,
                h2: ({ children }) => <h4 className="text-base font-bold text-slate-200 mt-6 mb-3">{children}</h4>,
                h3: ({ children }) => <h5 className="text-sm font-bold text-slate-300 mt-4 mb-2 uppercase tracking-wide">{children}</h5>,
                p: ({ children }) => <p className="text-sm text-slate-400 leading-relaxed mb-4 text-justify">{children}</p>,
                ul: ({ children }) => <ul className="space-y-2 mb-4 list-disc pl-4 marker:text-indigo-500/50">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-slate-400 pl-1">{children}</li>,
                strong: ({ children }) => <span className="text-indigo-200 font-bold">{children}</span>,
                a: ({ href, children }) => (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 transition-colors inline-flex items-center gap-1"
                    >
                        {children}
                    </a>
                ),
                blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-indigo-500/30 pl-4 py-2 my-6 bg-white/[0.02] rounded-r-xl italic text-slate-400">
                        {children as ReactNode}
                    </blockquote>
                ),
                hr: () => <hr className="border-white/10 my-8" />,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
