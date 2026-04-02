'use client';

import { Calendar, RefreshCcw } from 'lucide-react';
import { BoundaryNotice, GeoSummary, SourceBlock } from '@/components/seo/GeoBlocks';
import { CN_BOUNDARY_NOTICE, CN_DEFAULT_SOURCES, LegalShell } from './CnLayout';

export function ChineseRefundPage() {
  return (
    <LegalShell currentPage="refund" icon={RefreshCcw} eyebrow="Billing" title="退款政策" updatedAt="2026年1月27日">
      <div className="grid md:grid-cols-2 gap-6 text-left">
        <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/[0.05] space-y-3">
          <Calendar className="text-indigo-300" size={24} />
          <h3 className="font-bold text-white">48 小时冷静期</h3>
          <p className="text-slate-400 text-xs leading-relaxed">首次订阅 Pro 的用户，如在 48 小时内认为服务不适合，可申请全额退款。</p>
        </div>
        <div className="glass-card p-6 border-white/5 bg-white/[0.02] space-y-3">
          <RefreshCcw className="text-slate-400" size={24} />
          <h3 className="font-bold text-white">随时取消续订</h3>
          <p className="text-slate-400 text-xs leading-relaxed">你可以随时取消自动续订，当前计费周期内的使用权限会保留到周期结束。</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. 适用条件</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          全额退款仅适用于首次订阅用户，且申请必须在购买后的 48 小时内提交。重复订阅或曾享受退款政策的账户不适用。
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              summary={[
                '知守 AI 为首次 Pro 订阅提供 48 小时退款窗口。',
                '退款批准后，将通过 Stripe 退回到原支付方式。',
                '因滥用服务而被封禁的账户不适用退款政策。',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              sources={[
                ...CN_DEFAULT_SOURCES,
                { name: '退款政策说明', url: 'https://ziso.cc/cn/refund', accessedAt: '2026-04-02' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice text={CN_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}
