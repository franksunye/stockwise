'use client';

import { Shield, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { LegalShell, KO_BOUNDARY_NOTICE, KO_DEFAULT_SOURCES } from './KoLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

/**
 * Korean Privacy Policy
 */
export function KoreanPrivacyPage() {
  return (
    <LegalShell icon={Shield} eyebrow="개인정보 처리방침" title="개인정보 처리방침" updatedAt="2026년 1월 27일">
      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">1. 수집하는 정보</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          우리는 서비스 제공에 필요한 최소한의 정보만을 수집합니다:
        </p>
        <ul className="list-disc list-inside ml-2 space-y-2 text-sm text-slate-400 leading-relaxed">
          <li>계정 정보: 등록 및 로그인에 사용되는 이메일 주소.</li>
          <li>기본 설정: 관심 종목 리스트 및 알림 설정.</li>
          <li>결제 상태: 구독 액세스에 필요한 결제 상태 정보. 실제 결제 트랜잭션은 Stripe에서 처리하며, ZISO AI는 사용자의 카드번호나 보안 코드를 저장하지 않습니다.</li>
        </ul>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">2. 정보 활용 방식</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          수집된 정보는 계정 유지 관리, 개인화된 리서치 브리핑 전달, 고객 지원 제공 및 제품 신뢰성 향상을 위해 사용됩니다. 우리는 사용자의 개인 데이터를 제3자에게 판매하거나 대여하지 않습니다.
        </p>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">3. 데이터 보안</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          우리는 사용자 데이터를 보호하기 위해 업계 표준의 암호화 및 보안 제어 기능을 적용합니다. 다만 인터넷을 통한 어떠한 전송도 완전히 보안을 보장할 수는 없으므로, 사용자는 자신의 로그인 정보를 보호해야 할 책임이 있습니다.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity text-left text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="ko"
              summary={[
                'ZISO AI는 계정, 관심 종목, 통합 결제 및 알림 설정을 운영하는 데 필요한 운영 데이터만 수집합니다.',
                'Stripe를 통해 안전한 결제 처리가 이루어지며, ZISO AI는 민감한 카드 정보를 저장하지 않습니다.',
                '우리의 프라이버시 경계는 데이터 판매가 아닌 서비스 제공에 집중되어 있습니다.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="ko"
              sources={[
                ...KO_DEFAULT_SOURCES,
                { name: '개인정보 보호 준수', url: 'https://ziso.cc/privacy', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="ko" text={KO_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}

/**
 * Korean Terms of Service
 */
export function KoreanTermsPage() {
  return (
    <LegalShell icon={FileText} eyebrow="서비스 이용약관" title="서비스 이용약관" updatedAt="2026년 1월 27일">
      <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.02] flex gap-4 items-start text-left">
        <ShieldCheck className="text-amber-400 shrink-0 mt-1" size={20} />
        <div className="text-sm text-amber-100/80 leading-relaxed font-medium text-left">
          중요 고지: ZISO AI가 제공하는 모든 예측, 분석 및 보고서는 AI의 도움을 받아 생성된 정보 참고용 자료입니다.
          본 사이트의 어떠한 내용도 투자 권유, 금융 조언 또는 법적 조언을 구성하지 않습니다. 시장 리스크에 대한 최종 책임은 사용자 본인에게 있습니다.
        </div>
      </div>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">1. 서비스 범위</h2>
        <p className="text-slate-400 leading-relaxed text-sm text-left">
          ZISO AI는 AI 지원 시장 분석, 요약 브리핑 및 알림 워크플로우를 제공합니다. 사용자는 AI가 생성한 콘텐츠의 한계와 시장 예측에 내재된 불확실성을 인정합니다.
        </p>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">2. 사용자의 책임</h2>
        <p className="text-slate-400 leading-relaxed text-sm text-left">
          본인의 계정을 통해 이루어지는 활동에 대한 책임은 사용자에게 있습니다. 승인되지 않은 계정 사용이 발견될 경우 즉시 당사에 알려야 합니다.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity text-left text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="ko"
              summary={[
                'ZISO AI는 정보 및 연구 지원 목적으로만 AI 지원 시장 분석을 제공합니다.',
                '사용자는 자신의 투자 결정과 시장 활동의 결과에 대해 전적인 책임을 집니다.',
                '본 서비스는 개별화된 투자 조언보다는 투명한 분석 경계를 제공하는 데 중점을 둡니다.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="ko"
              sources={[
                ...KO_DEFAULT_SOURCES,
                { name: '법적 고지 및 약관', url: 'https://ziso.cc/terms', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="ko" text={KO_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}

/**
 * Korean Refund Policy
 */
export function KoreanRefundPage() {
  return (
    <LegalShell icon={RefreshCw} eyebrow="환불 규정" title="환불 규정" updatedAt="2026년 1월 27일">
      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">1. 구독 취소</h2>
        <p className="text-slate-400 leading-relaxed text-sm text-left">
          사용자는 언제든지 구독을 취소할 수 있습니다. 취소 시 현재 결제 주기가 끝날 때까지 Pro 기능을 계속 사용할 수 있으며, 이후에는 자동으로 갱신되지 않습니다.
        </p>
      </section>

      <section className="space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">2. 환불 조건</h2>
        <p className="text-slate-400 leading-relaxed text-sm text-left">
          디지털 콘텐츠 및 서비스의 특성상 이미 시작된 결제 주기에 대해서는 원칙적으로 환불이 되지 않습니다. 다만, 결제 후 24시간 이내에 서비스를 전혀 사용하지 않은 경우에 한해 예외적인 환불 요청을 검토할 수 있습니다.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity text-left text-left">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="ko"
              summary={[
                '구독은 언제든지 취소 가능하며, 현재 주기 종료 시점까지 권한이 유효합니다.',
                '디지털 리서치 서비스 특성상 원칙적으로 환불은 불가합니다.',
                '기술적 오류나 미사용 결제 건에 대해서는 24시간 이내에 예외적인 검토가 가능합니다.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="ko"
              sources={[
                ...KO_DEFAULT_SOURCES,
                { name: '환불 정책', url: 'https://ziso.cc/refund', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="ko" text={KO_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}
