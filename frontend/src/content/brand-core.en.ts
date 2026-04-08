import { type BrandCore } from "./brand-core.zh-CN";

export const brandCoreEn: BrandCore = {
  productName: "ZISO AI",
  shortName: "ZISO AI",
  domain: "https://ziso.cc",
  locale: "en-US",
  positioning: {
    id: "positioning_core_en",
    version: "v2026.04.08",
    effectiveFrom: "2026-04-08",
    owner: "growth+product",
    text: "AI does the research. You keep the decision. ZISO AI provides advanced stock intelligence powered by DeepSeek-V3 Full Model for traceable, logic-driven analysis.",
  },
  valueProposition: {
    id: "value_prop_core_en",
    version: "v2026.04.08",
    effectiveFrom: "2026-04-08",
    owner: "growth+product",
    text: "Leverage DeepSeek-V3 to standardize post-close review, tactical interpretation, and risk management, helping disciplined investors minimize emotional biases.",
  },
  coreFeatures: [
    {
      id: "feature_review_predict_en",
      version: "v2026.04.02",
      effectiveFrom: "2026-04-02",
      owner: "product",
      text: "Nightly Review & Next-Day Prediction: AI-generated insights based on multi-model and quant rules.",
    },
    {
      id: "feature_tactical_brief_en",
      version: "v2026.04.02",
      effectiveFrom: "2026-04-02",
      owner: "product",
      text: "Tactical Briefs: Key levels, action scripts, and risk boundaries delivered post-close.",
    },
    {
      id: "feature_closed_loop_en",
      version: "v2026.04.02",
      effectiveFrom: "2026-04-02",
      owner: "product",
      text: "Verified Performance: Traceable historical snapshots with hit-rate and model drift auditing.",
    },
    {
      id: "feature_almanac_en",
      version: "v2026.04.02",
      effectiveFrom: "2026-04-02",
      owner: "product",
      text: "Market Almanac: Pre-market weather and sentiment cards for disciplined emotional management.",
    },
  ],
  boundaryNotice: {
    id: "boundary_notice_core_en",
    version: "v2026.04.02",
    effectiveFrom: "2026-04-02",
    owner: "legal+growth",
    text: "All content is provided for research and informational purposes only. Nothing constitutes investment advice.",
  },
  defaultSources: [
    { name: "ZISO AI Research Center", url: "https://ziso.cc/learn" },
    { name: "ZISO AI Help Center", url: "https://ziso.cc/support" },
  ],
};
