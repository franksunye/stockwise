export interface FounderProfile {
  label: string;
  name: string;
  description: string;
}

export interface AgentProfileCard {
  name: string;
  role: string;
  description: string;
  avatarSeed: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  aboutGradient: string;
  pillar: 'quant' | 'ops';
}

export const founders: FounderProfile[] = [
  {
    label: 'AI 创始人 · AI FOUNDER',
    name: '安德烈·谷（Andre Gu）',
    description: '负责系统架构、自动化工程与交付节奏，把策略方法稳定落到产品。',
  },
  {
    label: '联合创始人 · CO-FOUNDER',
    name: '弗兰克·孙（Frank Sun）',
    description: '负责产品策略、交易框架与风险边界，确保输出可解释、可执行、可复盘。',
  },
];

export const agentTeam: AgentProfileCard[] = [
  {
    name: '林见微（混元 Lite）',
    role: '初级量化分析师 · JUNIOR QUANT ANALYST',
    description: '独立完成策略推演，输出个人结论与补充视角。',
    avatarSeed: 'lin-jianwei-hunyuan-lite',
    textColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    glowColor: 'bg-cyan-500',
    aboutGradient: 'from-cyan-500/20',
    pillar: 'quant',
  },
  {
    name: '顾深（DeepSeek）',
    role: '资深量化分析师 · SENIOR QUANT ANALYST',
    description: '独立完成深度策略推演，输出个人结论与风险判断。',
    avatarSeed: 'gu-shen-deepseek',
    textColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    glowColor: 'bg-indigo-500',
    aboutGradient: 'from-indigo-500/20',
    pillar: 'quant',
  },
  {
    name: '程矩（量化规则）',
    role: '规则量化分析师 · RULE QUANT ANALYST',
    description: '独立完成规则推演，输出规则侧结论与约束条件。',
    avatarSeed: 'cheng-ju-quant-rules',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    glowColor: 'bg-rose-500',
    aboutGradient: 'from-rose-500/20',
    pillar: 'quant',
  },
  {
    name: '诺岚（Nora）',
    role: '情报上下文官 · CONTEXT OFFICER',
    description: '过滤新闻与宏观噪音，补齐每条信号的真实语境。',
    avatarSeed: 'nora-context-desk',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    glowColor: 'bg-emerald-500',
    aboutGradient: 'from-emerald-500/20',
    pillar: 'ops',
  },
  {
    name: '维尔（Verifier）',
    role: '验证审计官 · VALIDATION AUDITOR',
    description: '收盘后回写校验，持续追踪命中率与误差漂移。',
    avatarSeed: 'verifier-audit-desk',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    glowColor: 'bg-amber-500',
    aboutGradient: 'from-amber-500/20',
    pillar: 'ops',
  },
];
