'use client';

import { motion } from 'framer-motion';
import { Copy, Check, Download, ShieldCheck, Mail, Key, Sparkles, User, Info } from 'lucide-react';
import { useState } from 'react';

interface Props {
  userId: string;
  tier: 'free' | 'pro';
  onLinkEmail: () => void;
  emailLinked?: string | null;
}

export function IdentityPassport({ userId, tier, onLinkEmail, emailLinked }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      {/* Premium Card Design */}
      <div className="p-1 rounded-[28px] bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-amber-500/30 border border-white/10 shadow-2xl">
        <div className="bg-[#0f0f16] rounded-[24px] overflow-hidden">
          {/* Card Header */}
          <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tier === 'pro' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                    <ShieldCheck size={18} />
                </div>
                <div>
                   <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Digital Passport</h4>
                   <p className="text-[10px] text-slate-500 font-bold">STOCKWISE AI IDENTITY</p>
                </div>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${tier === 'pro' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-500/10 text-slate-400 border border-white/5'}`}>
                {tier === 'pro' ? 'Premium Identity' : 'Standard Guest'}
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-5">
            <div>
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-2">User Access Secret</label>
                <div className="flex items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 group">
                    <span className="font-mono text-sm text-indigo-200 tracking-wider">
                        {userId}
                    </span>
                    <button 
                        onClick={handleCopy}
                        className="text-slate-500 hover:text-white transition-colors p-1"
                    >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Status</span>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${tier === 'pro' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'bg-indigo-400 animate-pulse'}`} />
                        <span className="text-[10px] font-bold text-slate-300 uppercase">{tier === 'pro' ? 'Encrypted PRO' : 'Active'}</span>
                    </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-1">Backup</span>
                    <div className="flex items-center gap-1.5 text-emerald-500/80">
                        <Check size={10} />
                        <span className="text-[10px] font-bold uppercase">Ready</span>
                    </div>
                </div>
            </div>

            {/* Recovery Route - Email Soft Link */}
            {tier === 'pro' && !emailLinked && (
                <button 
                    onClick={onLinkEmail}
                    className="w-full py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                >
                    <Mail size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">绑定支付/恢复邮箱 (推荐)</span>
                </button>
            )}

            {emailLinked && (
                 <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Mail size={12} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-400">{emailLinked}</span>
                    </div>
                    <span className="text-[8px] font-black text-emerald-500/60 uppercase">已保护</span>
                 </div>
            )}
          </div>

          {/* Footer Warning */}
          <div className="px-6 py-4 bg-red-500/5 flex items-start gap-3">
            <Info size={14} className="text-red-400/60 shrink-0 mt-0.5" />
            <p className="text-[9px] text-slate-500 leading-relaxed italic">
                这是您找回资产的唯一凭证。StockWise AI 并不存储您的明文个人资料，如果您卸载 PWA 且未保存此 ID，付费权益将无法找回。
            </p>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
    </div>
  );
}
