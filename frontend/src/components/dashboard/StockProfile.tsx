'use client';

import { motion } from 'framer-motion';
import { X as CloseIcon } from 'lucide-react';
import { StockData, AIPrediction } from '@/lib/types';

import { useState, useEffect } from 'react';
import { getCurrentUser } from '@/lib/user';

interface StockProfileProps {
  stock: StockData;
  onClose: () => void;
}

// 简单的内存缓存，避免短时间内重复请求
const historyCache: Record<string, { data: AIPrediction[]; timestamp: number }> = {};
const CACHE_TTL = 30 * 1000; // 30秒缓存

export function StockProfile({ stock, onClose }: StockProfileProps) {

  const [fullHistory, setFullHistory] = useState<AIPrediction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);


  // 优化：将数据请求推迟到动画结束之后，避免 IO/State 更新操作阻塞 iOS 的动画主线程
  // 典型的 "Interaction First, Data Later" 模式
  useEffect(() => {
    if (stock) {
      // 检查缓存 - 如果有缓存，可以立即显示，因为它是同步的，不会造成太多闪烁
      const cached = historyCache[stock.symbol];
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        setFullHistory(cached.data);
        return;
      }
      
      // 如果没有缓存，我们设置一个定时器，等动画跑完（约300-400ms）再发起请求
      // 这样保证了“点击->弹出”这关键的 100ms 是纯 UI 线程在跑
      const timer = setTimeout(() => {
        setLoadingHistory(true);
        getCurrentUser()
          .then(() => fetch(`/api/predictions?symbol=${stock.symbol}&limit=30`, {
            cache: 'no-store'
          }))
          .then(r => r.json())
          .then(data => {
            const predictions = data.predictions || [];
            setFullHistory(predictions);
            historyCache[stock.symbol] = { data: predictions, timestamp: Date.now() };
          })
          .catch(console.error)
          .finally(() => setLoadingHistory(false));
      }, 400); // 400ms 延迟，确保 spring 动画最剧烈的部分已经完成

      return () => clearTimeout(timer);
    }
  }, [stock]);



  // 使用完整的历史数据计算胜率，如果还在加载则使用传入的数据
  const historyToUse = fullHistory.length > 0 ? fullHistory : stock.history;
  const winCount = historyToUse?.filter(h => h.validation_status === 'Correct').length || 0;
  const totalCount = historyToUse?.filter(h => h.validation_status === 'Correct' || h.validation_status === 'Incorrect').length || 0;
  const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;

  return (
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
              <h2 className="text-xl font-black italic tracking-tighter text-white">
                {stock.name}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
            <CloseIcon className="w-5 h-5 text-slate-400" />
          </button>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-card p-4 text-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">回看通过率</span>
            <p className="text-3xl font-black mono text-emerald-500">{winRate}%</p>
          </div>
          <div className="glass-card p-4 text-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">完成回看</span>
            <p className="text-3xl font-black mono text-white">{totalCount}</p>
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
  );
}
