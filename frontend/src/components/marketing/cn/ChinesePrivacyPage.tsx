'use client';

import { Shield } from 'lucide-react';
import { BoundaryNotice, GeoSummary, SourceBlock } from '@/components/seo/GeoBlocks';
import { CN_BOUNDARY_NOTICE, CN_DEFAULT_SOURCES, LegalShell } from './CnLayout';

export function ChinesePrivacyPage() {
  return (
    <LegalShell currentPage="privacy" icon={Shield} eyebrow="Compliance" title="隐私政策" updatedAt="2026年1月27日">
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. 信息收集</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          我们仅收集为提供服务所必需的信息，包括账户邮箱、自选设置、通知偏好以及订阅状态。支付流程由 Stripe 处理，ZISO AI 不保存原始银行卡信息。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. 信息用途</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          这些信息用于维护账户、生成个性化研判、提供客服支持，并改进产品稳定性。我们不会向第三方出售或出租个人数据。
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. 数据安全</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          我们采用行业标准的加密和安全控制措施保护用户数据，但互联网传输无法做到绝对无风险，用户也需要妥善保管自身登录凭证。
        </p>
      </section>

      <section className="pt-6 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              summary={[
                '知守 AI 只收集运行账户、自选、订阅和通知所需的最小数据。',
                '原始支付处理由 Stripe 承担，系统避免存储敏感卡信息。',
                '隐私边界以提供服务为中心，而不是做行为数据转售。',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              sources={[
                ...CN_DEFAULT_SOURCES,
                { name: '隐私合规说明', url: 'https://ziso.cc/cn/privacy', accessedAt: '2026-04-02' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice text={CN_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}
