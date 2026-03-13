export interface BrandSource {
  name: string;
  url?: string;
}

export interface BrandMessage {
  id: string;
  version: string;
  effectiveFrom: string;
  owner: string;
  text: string;
}

export interface BrandCore {
  productName: string;
  shortName: string;
  domain: string;
  locale: string;
  positioning: BrandMessage;
  valueProposition: BrandMessage;
  coreFeatures: BrandMessage[];
  boundaryNotice: BrandMessage;
  defaultSources: BrandSource[];
}

export const brandCoreZhCN: BrandCore = {
  productName: "知守 AI (ZISO AI)",
  shortName: "ZISO AI",
  domain: "https://ziso.cc",
  locale: "zh-CN",
  positioning: {
    id: "positioning_core",
    version: "v2026.03.05",
    effectiveFrom: "2026-03-05",
    owner: "growth+product",
    text: "AI 做功课，你做决策。知守 AI 提供可复盘、可追溯、可检查过程的投资分析辅助。",
  },
  valueProposition: {
    id: "value_prop_core",
    version: "v2026.03.05",
    effectiveFrom: "2026-03-05",
    owner: "growth+product",
    text: "把盘后复盘、战术解读、风险预警和验证闭环标准化，帮助投资者减少情绪化交易。",
  },
  coreFeatures: [
    {
      id: "feature_review_predict",
      version: "v2026.03.05",
      effectiveFrom: "2026-03-05",
      owner: "product",
      text: "盘后复盘与次日预测：基于多模型与量化规则生成分析结论。",
    },
    {
      id: "feature_tactical_brief",
      version: "v2026.03.05",
      effectiveFrom: "2026-03-05",
      owner: "product",
      text: "战术简报：提供关键价位、操作建议与风险提示。",
    },
    {
      id: "feature_closed_loop",
      version: "v2026.03.05",
      effectiveFrom: "2026-03-05",
      owner: "product",
      text: "验证闭环：对历史判断进行可追溯复盘与通过率统计。",
    },
    {
      id: "feature_almanac",
      version: "v2026.03.05",
      effectiveFrom: "2026-03-05",
      owner: "product",
      text: "投资黄历：盘前市场气象与宜忌提示，用于辅助情绪管理。",
    },
  ],
  boundaryNotice: {
    id: "boundary_notice_core",
    version: "v2026.03.05",
    effectiveFrom: "2026-03-05",
    owner: "legal+growth",
    text: "所有内容仅供研究与信息参考，不构成投资建议或收益承诺。",
  },
  defaultSources: [
    { name: "知守 AI (ZISO AI) 投研中心", url: "https://ziso.cc/learn" },
    { name: "知守 AI (ZISO AI) 帮助中心", url: "https://ziso.cc/support" },
  ],
};
