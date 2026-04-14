import Image from 'next/image';
import Link from 'next/link';

type ProductHuntBadgeProps = {
  locale?: 'cn' | 'en';
};

const COPY = {
  cn: {
    label: 'Product Hunt 推荐',
    hint: '在 Product Hunt 查看 ZISO AI',
    note: '来自独立产品社区的公开背书',
  },
  en: {
    label: 'Featured on Product Hunt',
    hint: 'See ZISO AI on Product Hunt',
    note: 'Public validation from an independent product community',
  },
} as const;

const BADGE_HREF =
  'https://www.producthunt.com/products/ziso-ai?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-ziso-ai';
const BADGE_SRC =
  'https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1123329&theme=dark&t=1776155723847';

export function ProductHuntBadge({ locale = 'en' }: ProductHuntBadgeProps) {
  const copy = COPY[locale];

  return (
    <div className="pt-6 flex flex-col items-center gap-3">
      <div className="inline-flex flex-col items-center gap-2 rounded-[28px] border border-white/8 bg-white/[0.02] px-5 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
          {copy.label}
        </p>
        <p className="max-w-[280px] text-center text-xs leading-relaxed text-slate-500">
          {copy.note}
        </p>
      </div>
      <Link
        href={BADGE_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={copy.hint}
        className="group inline-flex rounded-[24px] border border-white/10 bg-white/[0.03] px-3 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.05]"
      >
        <Image
          alt="ZISO AI - AI stock research for disciplined investors | Product Hunt"
          src={BADGE_SRC}
          width={250}
          height={54}
          className="h-auto w-[220px] sm:w-[250px]"
        />
      </Link>
    </div>
  );
}
