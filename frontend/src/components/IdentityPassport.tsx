'use client';

import { Copy, Check, ShieldCheck, Mail, Info } from 'lucide-react';
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
      <div className="p-1 rounded-[24px] bg-white/5 border border-white/10">
        <div className="bg-[#0f0f16] rounded-[20px] overflow-hidden">
          <div className="p-5 space-y-4">
            
            {/* User ID Row */}
            <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">用户 ID (点击复制)</label>
                <button 
                    onClick={handleCopy}
                    className="w-full flex items-center justify-between gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all rounded-xl px-4 py-3 group text-left"
                >
                    <span className="font-mono text-sm text-slate-200 tracking-wider truncate">
                        {userId}
                    </span>
                    <div className="bg-white/5 p-1.5 rounded-lg text-slate-500 group-hover:text-white transition-colors">
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </div>
                </button>
            </div>

            {/* Email Row */}
            <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1.5 block">绑定邮箱</label>
                {emailLinked ? (
                     <div className="w-full py-3 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Mail size={14} className="text-emerald-500" />
                            <span className="text-xs font-medium text-slate-300">{emailLinked}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                            <Check size={10} /> 已保护
                        </span>
                     </div>
                ) : (
                    <button 
                        onClick={onLinkEmail}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-2.5">
                            <Mail size={14} className="text-indigo-400" />
                            <span className="text-xs font-medium text-indigo-200">未绑定安全邮箱</span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-400">去绑定 &rarr;</span>
                    </button>
                )}
            </div>

          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
    </div>
  );
}
