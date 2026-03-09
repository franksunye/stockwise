import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { BookOpen, Calendar, ChevronLeft } from "lucide-react";
import MarketingFooter from "@/components/MarketingFooter";
import { BoundaryNotice, FreshnessBlock, GeoSummary, SourceBlock } from "@/components/seo/GeoBlocks";
import { brandCoreZhCN } from "@/content/brand-core.zh-CN";
import { buildArticleJsonLd } from "@/lib/geo";
import { buildPageMetadata } from "@/lib/seo";
import { getAllSupportArticles, getArticleBySlug } from "@/lib/support-content";

type Params = Promise<{ slug: string }>;

const SUPPORT_TLDR: Record<string, string[]> = {
  "ai-council-logic": [
    "知守 AI 采用多模型并行分析，降低单模型偏差。",
    "结论优先看一致性，再看单模型观点。",
    "分歧较大时应降低仓位或先观察。",
  ],
  "tactical-brief-guide": [
    "战术简报要看结论、关键价位、风险反思三部分。",
    "重点不是观点强弱，而是失效条件是否明确。",
    "把简报当执行脚本，不当情绪安慰。",
  ],
  "history-matrix-viz": [
    "胜率矩阵用于观察模型在当前行情下的适配度。",
    "近期稳定比长期均值更有参考价值。",
    "连错期应降低信号权重，优先防守。",
  ],
  "multi-day-verification": [
    "知守采用多日验证口径，不用单日涨跌判断成败。",
    "核心目的是减少短噪音对策略评估的干扰。",
    "验证结果用于迭代模型，不用于事后包装。",
  ],
  "confidence-explained": [
    "置信度反映的是可解释性与环境匹配，不是收益承诺。",
    "低置信度阶段应减少激进操作。",
    "置信度应与风控阈值一起使用。",
  ],
  "key-levels-mapping": [
    "关键价位用于定义计划边界，不用于事后解释。",
    "支撑位和压力位要结合成交量和趋势一起看。",
    "跌破或突破关键位后，应同步更新执行策略。",
  ],
  "context-extraction": [
    "上下文提取的目标是减少噪音，不是增加信息量。",
    "优先看与持仓标的直接相关的事件和数据变化。",
    "同一新闻应结合价格位置判断影响强度。",
  ],
  "signal-flip-push": [
    "反转推送只关注观点方向的重大变化。",
    "减少无效提醒可以提升执行一致性。",
    "收到反转提醒后先核对边界条件再操作。",
  ],
  "realtime-data-splicing": [
    "实时拼接用于提高盘中指标可读性与时效性。",
    "盘中信号应和盘后结论结合，避免单点误判。",
    "同类指标冲突时以风控规则优先。",
  ],
  "on-demand-sync": [
    "按需同步优先保障自选与高关注标的的更新频率。",
    "资源调度目标是提升关键标的可用性。",
    "低关注标的降频不影响核心交易决策流程。",
  ],
  "tiers-explained": [
    "免费版适合基础体验，Pro 版适合高频复盘用户。",
    "升级判断应看监控数量、分析深度与验证需求。",
    "套餐差异以页面公开条款与当前版本为准。",
  ],
  "four-states-semantics": [
    "方向裁决全交给了稳定的量化规则，不再受AI情绪波动干扰。",
    "简化为四大硬性状态：进场、防守、观察、暂无信号。",
    "用极度明确的灯号，帮你摆脱信息过载导致的瘫痪。"
  ],
  "dual-lane-architecture": [
    "系统后台分为研究轨与生产轨，保证了呈现给你的极其稳定。",
    "AI会在验证池中进行激烈的容错测试与试错。",
    "只有测试中回撤小且极具胜率的法则，才会被发布到你的面前。"
  ],
  "investment-mode-config": [
    "个人中心的偏好设置升级为沉浸式的伸缩风琴设计。",
    "直连API，乐观更新逻辑避免等待时间，所见即所得。"
  ],
  "invitation-ops-guide": [
    "所有权限制由严密的后台邀请码控制（10-90天空窗期管理）。",
    "目的是阻断盲目投机，过滤给真正懂纪律的玩家分发算力。"
  ]
};

const SUPPORT_TO_LEARN_LINKS: Record<string, Array<{ slug: string; title: string }>> = {
  "ai-council-logic": [
    { slug: "101-67_hybrid_system", title: "101-67: AI + 人的混合系统" },
    { slug: "101-62_hallucination_control", title: "101-62: AI 幻觉的封印术" },
  ],
  "tactical-brief-guide": [
    { slug: "101-64_eod_vs_intraday", title: "101-64: 盘后分析 vs 盘中博弈" },
    { slug: "101-65_confidence_calibration", title: "101-65: 置信度解码" },
  ],
  "history-matrix-viz": [
    { slug: "101-65_confidence_calibration", title: "101-65: 置信度解码" },
    { slug: "101-81_case_reversal", title: "101-81: 实战案例：结构化反转" },
  ],
  "signal-flip-push": [
    { slug: "101-64_eod_vs_intraday", title: "101-64: 盘后分析 vs 盘中博弈" },
    { slug: "101-52_stop_loss_art", title: "101-52: 止损的艺术" },
  ],
  "on-demand-sync": [
    { slug: "101-67_hybrid_system", title: "101-67: AI + 人的混合系统" },
    { slug: "101-63_context_engineering", title: "101-63: 上下文工程" },
  ],
};

export function generateStaticParams(): Array<{ slug: string }> {
  return getAllSupportArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) {
    return buildPageMetadata(brandCoreZhCN.domain, {
      title: "支持文档未找到 | 知守 AI",
      description: "该支持文档不存在或已下线。",
      path: `/support/${slug}`,
    });
  }

  return buildPageMetadata(brandCoreZhCN.domain, {
    title: `${article.title} | 支持中心 | 知守 AI`,
    description: `${article.category} - ${article.title}`,
    path: `/support/${article.slug}`,
    keywords: ["知守AI支持", article.category, article.title],
    type: "article",
  });
}

export default async function SupportDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();
  const related = getAllSupportArticles()
    .filter((item) => item.category === article.category && item.slug !== article.slug)
    .slice(0, 3);
  const relatedLearn = SUPPORT_TO_LEARN_LINKS[article.slug] || [];

  const pageUrl = `${brandCoreZhCN.domain}/support/${article.slug}`;
  const jsonLd = buildArticleJsonLd({
    pageTitle: article.title,
    pageDescription: `${article.category} - ${article.title}`,
    pageUrl,
    dateModified: article.lastUpdated,
    sources: brandCoreZhCN.defaultSources,
  });

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/support"
            className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            <span className="text-xs font-bold">返回</span>
          </Link>
          <div className="text-slate-600 text-[10px] uppercase font-black tracking-[0.2em] hidden md:block">
            Support Guide
          </div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <header className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
              {article.category}
            </span>
            <div className="h-px w-8 bg-white/10" />
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
              <Calendar size={12} />
              {article.lastUpdated}
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight italic">
            {article.title}
          </h1>
        </header>

        <div className="relative h-32 md:h-48 rounded-[32px] border border-white/5 bg-gradient-to-br from-indigo-500/5 to-transparent flex items-center justify-center overflow-hidden mt-10">
          <BookOpen className="w-12 h-12 text-indigo-500/20" />
        </div>

        <article className="prose prose-invert prose-indigo max-w-none mt-10">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h2 className="text-2xl font-black text-white mt-12 mb-6 tracking-tight italic border-l-4 border-indigo-500 pl-4">
                  {children}
                </h2>
              ),
              h2: ({ children }) => (
                <h3 className="text-xl font-bold text-slate-200 mt-10 mb-4">{children}</h3>
              ),
              h3: ({ children }) => (
                <h4 className="text-lg font-bold text-slate-300 mt-8 mb-3">{children}</h4>
              ),
              p: ({ children }) => (
                <p className="text-base text-slate-400 leading-relaxed mb-6 text-justify font-medium">
                  {children}
                </p>
              ),
              ul: ({ children }) => <ul className="space-y-3 mb-8 list-none pl-2">{children}</ul>,
              li: ({ children }) => (
                <li className="flex items-start gap-3 text-slate-400 font-medium">
                  <div className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => <strong className="text-indigo-100 font-black">{children}</strong>,
              blockquote: ({ children }) => (
                <div className="my-10 p-6 md:p-8 rounded-[24px] bg-white/[0.02] border border-white/5 relative overflow-hidden italic shadow-inner">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                  <span className="text-slate-400 font-medium leading-relaxed block">{children}</span>
                </div>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 decoration-2"
                >
                  {children}
                </a>
              ),
              hr: () => <hr className="border-white/5 my-12" />,
            }}
          >
            {article.content}
          </ReactMarkdown>
        </article>

        <GeoSummary summary={SUPPORT_TLDR[article.slug] || []} />

        <SourceBlock
          sources={[
            {
              name: "StockWise Support Center",
              url: "https://ziso.cc/support",
              accessedAt: article.lastUpdated,
              claimScope: "功能机制定义",
            },
            {
              name: "StockWise Learn Center",
              url: "https://ziso.cc/learn",
              accessedAt: article.lastUpdated,
              claimScope: "方法论与术语口径",
            },
          ]}
        />
        <FreshnessBlock updatedAt={article.lastUpdated} />
        <BoundaryNotice text={brandCoreZhCN.boundaryNotice.text} />

        {related.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mt-8">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">相关推荐</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/support/${item.slug}`}
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {relatedLearn.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mt-8">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">相关学习页</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {relatedLearn.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/learn/${item.slug}`}
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingFooter />
    </div>
  );
}
