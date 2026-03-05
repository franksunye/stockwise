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

export type TeamMemberId =
  | 'andre_gu'
  | 'frank_sun'
  | 'gu_shen'
  | 'lin_xu'
  | 'cheng_ju'
  | 'nora'
  | 'verifier'
  | 'fallback';

interface TeamVisualStyle {
  textColor: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  aboutGradient: string;
}

export interface TeamMemberProfile {
  id: TeamMemberId;
  name: string;
  displayName: string;
  role: string;
  roleEn?: string;
  avatarSeed: string;
  briefSummary: string;
  aboutDescription: string;
  unit: 'founder' | 'quant' | 'ops' | 'fallback';
  founderLabel?: string;
  style?: TeamVisualStyle;
}

const TEAM_MEMBER_DIRECTORY: Record<TeamMemberId, TeamMemberProfile> = {
  andre_gu: {
    id: 'andre_gu',
    name: '安德烈·谷',
    displayName: '安德烈·谷（Andre Gu）',
    role: 'AI 创始人',
    roleEn: 'AI FOUNDER',
    avatarSeed: 'andre-gu-ai-founder',
    briefSummary: '负责系统架构、自动化工程与交付节奏，把策略方法稳定落到产品。',
    aboutDescription: '负责系统架构、自动化工程与交付节奏，把策略方法稳定落到产品。',
    unit: 'founder',
    founderLabel: 'AI 创始人 · AI FOUNDER',
  },
  frank_sun: {
    id: 'frank_sun',
    name: '弗兰克·孙',
    displayName: '弗兰克·孙（Frank Sun）',
    role: '联合创始人',
    roleEn: 'CO-FOUNDER',
    avatarSeed: 'frank-sun-cofounder',
    briefSummary: '负责产品策略、交易框架与风险边界，确保输出可解释、可执行、可复盘。',
    aboutDescription: '负责产品策略、交易框架与风险边界，确保输出可解释、可执行、可复盘。',
    unit: 'founder',
    founderLabel: '联合创始人 · CO-FOUNDER',
  },
  lin_xu: {
    id: 'lin_xu',
    name: '林序',
    displayName: '林序（混元 Lite）',
    role: '初级量化分析师',
    roleEn: 'JUNIOR QUANT ANALYST',
    avatarSeed: 'lin-xu-hunyuan-lite',
    briefSummary: '独立完成策略推演，输出个人结论与补充视角。',
    aboutDescription: '独立完成策略推演，输出个人结论与补充视角。',
    unit: 'quant',
    style: {
      textColor: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      glowColor: 'bg-cyan-500',
      aboutGradient: 'from-cyan-500/20',
    },
  },
  gu_shen: {
    id: 'gu_shen',
    name: '顾深',
    displayName: '顾深（DeepSeek）',
    role: '资深量化分析师',
    roleEn: 'SENIOR QUANT ANALYST',
    avatarSeed: 'gu-shen-deepseek',
    briefSummary: '独立完成深度策略推演，输出个人结论与风险判断。',
    aboutDescription: '独立完成深度策略推演，输出个人结论与风险判断。',
    unit: 'quant',
    style: {
      textColor: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
      glowColor: 'bg-indigo-500',
      aboutGradient: 'from-indigo-500/20',
    },
  },
  cheng_ju: {
    id: 'cheng_ju',
    name: '程矩',
    displayName: '程矩（量化规则）',
    role: '规则量化分析师',
    roleEn: 'RULE QUANT ANALYST',
    avatarSeed: 'cheng-ju-quant-rules',
    briefSummary: '独立完成规则推演，输出规则侧结论与约束条件。',
    aboutDescription: '独立完成规则推演，输出规则侧结论与约束条件。',
    unit: 'quant',
    style: {
      textColor: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      glowColor: 'bg-rose-500',
      aboutGradient: 'from-rose-500/20',
    },
  },
  nora: {
    id: 'nora',
    name: '诺岚',
    displayName: '诺岚（Nora）',
    role: '情报上下文官',
    roleEn: 'CONTEXT OFFICER',
    avatarSeed: 'nora-context-desk',
    briefSummary: '过滤新闻与宏观噪音，补齐每条信号的真实语境。',
    aboutDescription: '过滤新闻与宏观噪音，补齐每条信号的真实语境。',
    unit: 'ops',
    style: {
      textColor: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      glowColor: 'bg-emerald-500',
      aboutGradient: 'from-emerald-500/20',
    },
  },
  verifier: {
    id: 'verifier',
    name: '维尔',
    displayName: '维尔（Verifier）',
    role: '验证审计官',
    roleEn: 'VALIDATION AUDITOR',
    avatarSeed: 'verifier-audit-desk',
    briefSummary: '收盘后回写校验，持续追踪命中率与误差漂移。',
    aboutDescription: '收盘后回写校验，持续追踪命中率与误差漂移。',
    unit: 'ops',
    style: {
      textColor: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      glowColor: 'bg-amber-500',
      aboutGradient: 'from-amber-500/20',
    },
  },
  fallback: {
    id: 'fallback',
    name: '量化分析成员',
    displayName: '量化分析成员',
    role: 'AI 研判席',
    avatarSeed: 'ziso-council-fallback',
    briefSummary: '基于结构化推理流程输出结论，并与风控约束联合校验。',
    aboutDescription: '基于结构化推理流程输出结论，并与风控约束联合校验。',
    unit: 'fallback',
  },
};

const FOUNDER_ORDER: TeamMemberId[] = ['andre_gu', 'frank_sun'];
const AGENT_CARD_ORDER: TeamMemberId[] = ['lin_xu', 'gu_shen', 'cheng_ju', 'nora', 'verifier'];

export const founders: FounderProfile[] = FOUNDER_ORDER.map((id) => {
  const member = TEAM_MEMBER_DIRECTORY[id];
  return {
    label: member.founderLabel || `${member.role}${member.roleEn ? ` · ${member.roleEn}` : ''}`,
    name: member.displayName,
    description: member.aboutDescription,
  };
});

export const agentTeam: AgentProfileCard[] = AGENT_CARD_ORDER.map((id) => {
  const member = TEAM_MEMBER_DIRECTORY[id];
  const style = member.style || {
    textColor: 'text-slate-400',
    bgColor: 'bg-white/5',
    borderColor: 'border-white/10',
    glowColor: 'bg-white/20',
    aboutGradient: 'from-white/10',
  };
  return {
    name: member.displayName,
    role: `${member.role}${member.roleEn ? ` · ${member.roleEn}` : ''}`,
    description: member.aboutDescription,
    avatarSeed: member.avatarSeed,
    textColor: style.textColor,
    bgColor: style.bgColor,
    borderColor: style.borderColor,
    glowColor: style.glowColor,
    aboutGradient: style.aboutGradient,
    pillar: member.unit === 'ops' ? 'ops' : 'quant',
  };
});

export type AnalystId = TeamMemberId;
export type AnalystProfile = TeamMemberProfile;

export function getTeamMemberById(id: TeamMemberId): TeamMemberProfile {
  return TEAM_MEMBER_DIRECTORY[id];
}

export function getTeamMembers(): TeamMemberProfile[] {
  return Object.values(TEAM_MEMBER_DIRECTORY).filter((m) => m.id !== 'fallback');
}

export function getQuantAnalysts(): TeamMemberProfile[] {
  return Object.values(TEAM_MEMBER_DIRECTORY).filter((m) => m.unit === 'quant');
}

export function getAnalystById(id: AnalystId): AnalystProfile {
  return TEAM_MEMBER_DIRECTORY[id];
}

export function resolveAnalystFromModel(modelLike: string | undefined | null): AnalystProfile {
  const raw = (modelLike || '').toLowerCase();
  if (raw.includes('deepseek')) return TEAM_MEMBER_DIRECTORY.gu_shen;
  if (raw.includes('gemini') || raw.includes('hunyuan') || raw.includes('混元')) return TEAM_MEMBER_DIRECTORY.lin_xu;
  if (raw.includes('rule') || raw.includes('规则') || raw.includes('quant')) return TEAM_MEMBER_DIRECTORY.cheng_ju;
  return TEAM_MEMBER_DIRECTORY.fallback;
}

export function resolveAnalystForBriefSource(
  sourceKind: 'llm' | 'rule',
  modelLike: string | undefined | null
): AnalystProfile {
  if (sourceKind === 'rule') return TEAM_MEMBER_DIRECTORY.cheng_ju;
  return resolveAnalystFromModel(modelLike);
}

export function resolveBriefAuthorByTier(tier: 'free' | 'pro'): AnalystProfile {
  return tier === 'pro' ? TEAM_MEMBER_DIRECTORY.gu_shen : TEAM_MEMBER_DIRECTORY.lin_xu;
}
