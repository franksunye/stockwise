import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

interface LocalePreviewPageProps {
  eyebrow: string;
  title: string;
  description: string;
  canonicalPath: string;
  isFallback?: boolean;
}

export default function LocalePreviewPage({
  eyebrow,
  title,
  description,
  canonicalPath,
  isFallback = false,
}: LocalePreviewPageProps) {
  const canonicalHref = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans">
      <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-20">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute left-[-10%] top-[-5%] h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        </div>

        <div className="relative z-10 rounded-[36px] border border-white/10 bg-white/[0.03] p-8 md:p-12 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-indigo-300">{eyebrow}</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">{description}</p>

          <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-7 text-amber-100">
            {isFallback
              ? 'English content for this article is not published yet. This verification route exists for i18n and SEO infrastructure only.'
              : 'This English route is intentionally kept out of navigation and search indexing during Phase 1 infrastructure rollout.'}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href={canonicalHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-black text-white transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              <ArrowLeft size={16} />
              View Chinese Canonical
            </Link>
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-200 transition-all hover:bg-white/10"
            >
              Open App
              <ExternalLink size={15} />
            </Link>
          </div>
        </div>
      </main>
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs font-medium text-slate-500">
        Phase 1 public i18n infrastructure preview. This route is intentionally hidden from navigation and search indexing.
      </footer>
    </div>
  );
}
