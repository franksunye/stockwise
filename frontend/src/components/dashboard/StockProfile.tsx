'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon, Briefcase, Eye, User, Check } from 'lucide-react';
import { StockData, AIPrediction } from '@/lib/types';
import { getRule, saveRule } from '@/lib/storage';
import { useState, useEffect } from 'react';

interface StockProfileProps {
  stock: StockData | null;
  isOpen: boolean;
  onClose: () => void;
}

// 简单的内存缓存，避免短时间内重复请求
const historyCache: Record<string, { data: AIPrediction[]; timestamp: number }> = {};
const CACHE_TTL = 30 * 1000; // 30秒缓存

export function StockProfile({ stock, isOpen, onClose }: StockProfileProps) {
  const [position, setPosition] = useState<'holding' | 'empty' | 'none'>('none');
  const [fullHistory, setFullHistory] = useState<AIPrediction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);


  // 打开档案时请求完整的30条历史数据（带缓存）
  useEffect(() => {
    if (isOpen && stock) {
      const rule = getRule(stock.symbol);
      setPosition(rule?.position || 'none');
      
      // 检查缓存
      const cached = historyCache[stock.symbol];
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // 缓存有效，直接使用
        setFullHistory(cached.data);
        return;
      }
      
      // 缓存无效或不存在，请求新数据
      setLoadingHistory(true);
      fetch(`/api/predictions?symbol=${stock.symbol}&limit=30`, { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          const predictions = data.predictions || [];
          setFullHistory(predictions);
          // 更新缓存
          historyCache[stock.symbol] = { data: predictions, timestamp: Date.now() };
        })
        .catch(console.error)
        .finally(() => setLoadingHistory(false));
    }
  }, [isOpen, stock]);

  if (!stock) return null; // 渲染守护

  const handlePositionChange = (newPos: 'holding' | 'empty' | 'none') => {
    setPosition(newPos);
    if (stock) {
      saveRule(stock.symbol, { position: newPos });
    }
  };

  // 使用完整的历史数据计算胜率，如果还在加载则使用传入的数据
  const historyToUse = fullHistory.length > 0 ? fullHistory : stock.history;
  const winCount = historyToUse?.filter(h => h.validation_status === 'Correct').length || 0;
  const totalCount = historyToUse?.filter(h => h.validation_status !== 'Pending').length || 0;
  const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.1, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 150) onClose();
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[200] bg-[#050508] flex flex-col pointer-events-auto shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
        >
          {/* 顶部视觉拉手 */}
          <div className="w-full flex justify-center pt-3 pb-1">
             <div className="w-12 h-1 rounded-full bg-white/10" />
          </div>

          <div className="h-full w-full p-8 pt-6 flex flex-col overflow-y-auto">
            <header className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black italic text-indigo-500">
                  {stock.symbol.slice(-2)}
                </div>
                <div className="space-y-1">
                  <h2 className="text-3xl font-black italic tracking-tighter text-white">
                    {stock.name}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-indigo-500" />
                    个股详情 <span className="opacity-50">PROFILE</span>
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                <CloseIcon className="w-5 h-5 text-slate-400" />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="glass-card p-4 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">历史胜率</span>
                <p className="text-3xl font-black mono text-emerald-500">{winRate}%</p>
              </div>
              <div className="glass-card p-4 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">累计验证</span>
                <p className="text-3xl font-black mono text-white">{totalCount}</p>
              </div>
            </div>

            {/* 持仓配置 (极简模式) */}
            <div className="mb-8">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">持仓状态 (AI 决策上下文)</h3>
               <div className="grid grid-cols-3 gap-3">
                 {[
                   { id: 'holding', label: '已持仓', icon: Briefcase, activeColor: 'bg-emerald-500 text-white' },
                   { id: 'empty', label: '未建仓', icon: Eye, activeColor: 'bg-blue-500 text-white' },
                   { id: 'none', label: '观望', icon: User, activeColor: 'bg-slate-600 text-white' }
                 ].map(opt => {
                   const isActive = position === opt.id;
                   const Icon = opt.icon;
                   return (
                     <button
                       key={opt.id}
                        onClick={() => handlePositionChange(opt.id as 'holding' | 'empty' | 'none')}
                       className={`flex flex-col items-center justify-center py-4 rounded-2xl border transition-all ${
                         isActive 
                           ? `${opt.activeColor} border-transparent shadow-[0_8px_16px_rgba(0,0,0,0.3)] scale-105` 
                           : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                       }`}
                     >
                       <Icon size={20} className="mb-2" />
                       <span className="text-xs font-bold">{opt.label}</span>
                       {isActive && <div className="absolute top-2 right-2"><Check size={12} /></div>}
                     </button>
                   );
                 })}
               </div>
            </div>

            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">
              复盘矩阵 (最近 30 天) {loadingHistory && <span className="text-indigo-500 animate-pulse">加载中...</span>}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {historyToUse.map((h, i) => (
                <div 
                  key={i} 
                  className={`aspect-square rounded-xl border border-white/5 flex items-center justify-center text-[10px] font-black ${
                    h.validation_status === 'Correct' ? 'bg-emerald-500/10 text-emerald-500/50' : 
                    h.validation_status === 'Incorrect' ? 'bg-rose-500/10 text-rose-500/50' : 'bg-white/5 text-slate-700'
                  }`}
                >
                  {h.target_date.split('-').slice(1).join('/')}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
