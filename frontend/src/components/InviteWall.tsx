'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Loader2, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  onSuccess: (tier: string, expiresAt: string | null) => void;
}

export function InviteWall({ onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async () => {
    if (!code || loading) return;
    setLoading(true);
    setError(null);

    const userId = localStorage.getItem('STOCKWISE_USER_ID') || 'user_' + Math.random().toString(36).substr(2, 9);
    if (!localStorage.getItem('STOCKWISE_USER_ID')) {
        localStorage.setItem('STOCKWISE_USER_ID', userId);
    }

    try {
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code })
      });
      const data = await res.json();

      if (data.success) {
        onSuccess(data.tier, data.expiresAt);
      } else {
        setError(data.error || '无效的激活码');
      }
    } catch {
      setError('网络请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#050508] flex items-center justify-center p-6 text-white overflow-hidden font-sans">
      {/* 动态背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[32px] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_20px_40px_rgba(99,102,241,0.3)] mb-8">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-4">
            STOCKWISE <span className="text-indigo-500">BETA</span>
          </h1>
          <p className="text-slate-400 font-medium leading-relaxed px-4">
            目前处于邀请制内测阶段。请输入您的专属激活码以解锁 AI 决策系统。
          </p>
        </div>

        <div className="glass-card p-10 border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[40px]">
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                ENTER INVITE CODE
              </label>
              <div className="relative group">
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="PRO-XXXXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xl font-mono tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all group-hover:bg-white/[0.07]"
                />
                <button 
                  onClick={handleRedeem}
                  disabled={!code || loading}
                  className="absolute right-2 top-2 bottom-2 aspect-square rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-90"
                >
                  {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
                </button>
              </div>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-500 text-xs font-bold mt-4 text-center"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <div className="pt-4 grid grid-cols-2 gap-4">
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-indigo-400" />
                  验证身份
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <Zap size={14} className="text-purple-400" />
                  解锁功能
               </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">
            没有邀请码? 关注官方社群获取
        </p>
      </motion.div>

      <style jsx global>{`
        .glass-card { 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          box-shadow: 0 40px 100px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}
