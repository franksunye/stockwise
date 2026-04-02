'use client';

import { FileText, ShieldAlert } from 'lucide-react';
import { BoundaryNotice, GeoSummary, SourceBlock } from '@/components/seo/GeoBlocks';
import { CN_BOUNDARY_NOTICE, CN_DEFAULT_SOURCES, LegalShell } from './CnLayout';

export function ChineseTermsPage() {
  return (
    <LegalShell currentPage="terms" icon={FileText} eyebrow="Legal" title="服务条款" updatedAt="2026年1月27日">
      <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.02] flex gap-4 items-start text-left">
        <ShieldAlert className="text-amber-400 shrink-0 mt-1" size={20} />
        <div className="text-sm text-amber-100/80 leading-relaxed font-medium">
          重要声明：ZISO AI 提供的所有预测、分析和报告均由 AI 辅助生成，仅供研究参考，不构成投资建议、财务建议或法律意见。市场风险由用户自行承担。
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. 服务范围</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          ZISO AI 提供 AI 辅助的市场分析、研判摘要与提醒流程。用户应知悉 AI 生成内容的局限性，并理解市场预测天然存在不确定性。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. 账户责任</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          用户应对通过自身账户发生的活动负责。如发现任何未授权使用情形，应尽快联系我们处理。
        </p>
      </section>

      <section className="pt-6 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              summary={[
                '知守 AI 提供的是研究辅助与信息整理服务，不是个性化投资建议。',
                '用户应独立承担交易决策及其法律后果。',
                '产品强调分析边界透明，而非收益承诺。',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              sources={[
                ...CN_DEFAULT_SOURCES,
                { name: '法律与条款说明', url: 'https://ziso.cc/cn/terms', accessedAt: '2026-04-02' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice text={CN_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}
