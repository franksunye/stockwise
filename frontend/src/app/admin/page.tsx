'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  TrendingUp, 
  Database, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  LayoutGrid,
  Terminal,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface Stats {
  strategy: string;
  counts: {
    global_stocks: number;
    watchlists: number;
    prices: number;
    predictions: number;
    users: number;
    stock_meta_total: number;
    stock_meta_hk: number;
    stock_meta_cn: number;
  };
  lastUpdates: {
    stocks: string | null;
    prices: string | null;
    predictions: string | null;
    stock_meta: string | null;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-500 text-xs font-black uppercase tracking-widest">系统概况加载中...</p>
        </div>
      </div>
    );
  }

    const statCards = [
    { label: '注册用户', value: stats?.counts?.users || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: '核心股票池', value: stats?.counts?.global_stocks || 0, icon: Database, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: '总关注记录', value: stats?.counts?.watchlists || 0, icon: LayoutGrid, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'AI 预测总量', value: stats?.counts?.predictions || 0, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: '价格快照', value: stats?.counts?.prices || 0, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-indigo-500 outline-none" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">系统管理中心</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter">BACKEND <span className="text-indigo-500 underline decoration-4 underline-offset-8">OVERVIEW</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 transition-colors ${stats?.strategy === 'cloud' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${stats?.strategy === 'cloud' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
              <span className="text-xs font-black uppercase tracking-widest">
                {stats?.strategy === 'cloud' ? '☁️ 云端模式 (Turso)' : '🏠 本地模式 (SQLite)'}
              </span>
            </div>
            <button 
              onClick={fetchStats}
              disabled={refreshing}
              className={`p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-90 transition-all ${refreshing ? 'animate-spin opacity-50' : 'hover:bg-white/10'}`}
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map((card, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6 flex flex-col justify-between"
            >
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
                <p className="text-3xl font-black mono">{card.value.toLocaleString()}</p>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Stock Meta Stats */}
        <section className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">股票元数据库</h2>
            </div>
            <p className="text-[10px] mono text-slate-600">
              最后同步: {stats?.lastUpdates.stock_meta ? new Date(stats.lastUpdates.stock_meta).toLocaleString('zh-CN', { hour12: false }) : '-'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black mono text-white mb-2">{(stats?.counts.stock_meta_total || 0).toLocaleString()}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">总股票数</p>
            </div>
            <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black mono text-rose-400 mb-2">{(stats?.counts.stock_meta_cn || 0).toLocaleString()}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">A 股</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 text-center">
              <p className="text-4xl font-black mono text-blue-400 mb-2">{(stats?.counts.stock_meta_hk || 0).toLocaleString()}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">港 股</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data Timelines */}
          <section className="glass-card p-8 space-y-8">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">数据同步轨迹</h2>
            </div>
            <div className="space-y-6">
              {[
                { label: '元数据同步', date: stats?.lastUpdates.stock_meta, color: 'bg-pink-500' },
                { label: '核心资产同步', date: stats?.lastUpdates.stocks, color: 'bg-indigo-500' },
                { label: '行情数据对齐', date: stats?.lastUpdates.prices, color: 'bg-emerald-500' },
                { label: '策略模型更新', date: stats?.lastUpdates.predictions, color: 'bg-amber-500' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                    {i < 3 && <div className="w-0.5 h-8 bg-white/5 rounded-full" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-bold text-slate-200">{item.label}</p>
                      <p className="text-[10px] font-black mono text-slate-500">{item.date ? new Date(item.date).toLocaleString('zh-CN', { hour12: false }) : '永不'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="space-y-4">
             <Link href="/admin/pool" className="group block">
               <div className="glass-card p-8 flex items-center justify-between hover:bg-white/[0.04] transition-all border-indigo-500/20">
                 <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all">
                     <BarChart3 className="w-7 h-7 text-indigo-500" />
                   </div>
                   <div>
                     <h2 className="text-xl font-black italic tracking-tighter mb-1">监控池维护</h2>
                     <p className="text-xs text-slate-500 font-medium">手动增减核心跟踪标的，触发全量数据同步</p>
                   </div>
                 </div>
                 <ArrowRight className="text-slate-700 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
               </div>
             </Link>

             <Link href="/admin/traces" className="group block">
               <div className="glass-card p-8 flex items-center justify-between hover:bg-white/[0.04] transition-all border-emerald-500/20">
                 <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                     <Terminal className="w-7 h-7 text-emerald-500" />
                   </div>
                   <div>
                     <h2 className="text-xl font-black italic tracking-tighter mb-1">Chain 调试终端</h2>
                     <p className="text-xs text-slate-500 font-medium">可视化查看 LLM 执行全链路 (Prompt & Response)</p>
                   </div>
                 </div>
                 <ArrowRight className="text-slate-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
               </div>
             </Link>

             <Link href="/admin/llm-traces" className="group block">
               <div className="glass-card p-8 flex items-center justify-between hover:bg-white/[0.04] transition-all border-amber-500/20">
                 <div className="flex items-center gap-6">
                   <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-all">
                     <MessageSquare className="w-7 h-7 text-amber-500" />
                   </div>
                   <div>
                     <h2 className="text-xl font-black italic tracking-tighter mb-1">LLM 调用日志</h2>
                     <p className="text-xs text-slate-500 font-medium">查看单次（One-shot）LLM 调用的原始 Prompt 与响应数据</p>
                   </div>
                 </div>
                 <ArrowRight className="text-slate-700 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
               </div>
             </Link>

             <div className="glass-card p-8 flex items-center opacity-40 grayscale cursor-not-allowed">
               <div className="flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                   <Users className="w-7 h-7 text-slate-500" />
                 </div>
                 <div>
                   <h2 className="text-xl font-black italic tracking-tighter mb-1">用户反馈库</h2>
                   <p className="text-xs text-slate-500 font-medium">查看并处理用户提交的市场反馈信息</p>
                 </div>
               </div>
             </div>
          </section>
        </div>

        {/* CSS for local usage if needed */}
        <style jsx global>{`
          .glass-card {
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 32px;
          }
          .mono {
            font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
          }
        `}</style>
      </div>
    </div>
  );
}
