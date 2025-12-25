'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, ChevronDown, Grid, ArrowLeft, Info, Menu
} from 'lucide-react';

// --- 1. Types & Mock Data ---
interface HistoryRecord {
  date: string;
  signal: 'Long' | 'Short' | 'Side';
  title: string;
  reason: string;
  support: number;
}

interface Stock {
  symbol: string;
  name: string;
  color: string;
  history: HistoryRecord[];
}

const MOCK_DATA: Stock[] = [
  {
    symbol: '02171',
    name: '科济药业-B',
    color: '#6366f1',
    history: [
      { date: '今日', signal: 'Long', title: '突破关键压力位', reason: 'RSI背离修正完成，量能显著放大，机构席位出现异动抢筹，建议在5.20附近果断试错。', support: 5.12 },
      { date: '12-24', signal: 'Side', title: '震荡筑底阶段', reason: '目前处于缩量整理阶段，支撑位测试中，建议保持观望，等待信号明确。', support: 4.85 },
      { date: '12-23', signal: 'Short', title: '短线回调预警', reason: '技术指标超买，面临均线压力，需警惕获利盘了结带来的向下波动。', support: 5.30 },
    ]
  },
  {
    symbol: '01167',
    name: '加科思-B',
    color: '#10b981',
    history: [
      { date: '今日', signal: 'Side', title: '底部横盘整理', reason: '由于缺乏消息面刺激，股价在支撑线上方小幅震荡，暂无明确进攻信号。', support: 3.45 },
      { date: '12-24', signal: 'Long', title: '放量上攻前奏', reason: 'MACD金叉初现，行业板块景气度回升，有望挑战前高压力位。', support: 3.20 },
    ]
  },
  {
    symbol: '00700',
    name: '腾讯控股',
    color: '#0ea5e9',
    history: [
      { date: '今日', signal: 'Long', title: '权重股估值修复', reason: '南向资金持续流入，回购力度加大，基本面支撑强劲，适合长期投资者。', support: 410.0 },
      { date: '12-24', signal: 'Side', title: '平稳过度期', reason: '在大盘波动背景下表现出极强韧性，建议作为底仓配置。', support: 405.0 },
    ]
  }
];

// --- 2. Components ---

/**
 * 股票档案页 (Z-axis)
 */
function StockProfile({ stock, isOpen, onClose }: { stock: Stock, isOpen: boolean, onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[200] bg-[#050508] p-6 flex flex-col"
        >
          <button onClick={onClose} className="mb-8 p-3 w-fit rounded-full bg-white/5 border border-white/10">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          
          <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-black italic" style={{ color: stock.color }}>
              {stock.symbol.slice(-2)}
            </div>
            <div>
              <h2 className="text-2xl font-black italic tracking-tighter text-white">{stock.name}</h2>
              <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">{stock.symbol}.HK · 统计档案</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="glass-card p-4 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">历史胜率</span>
              <p className="text-3xl font-black mono text-emerald-500">76%</p>
            </div>
            <div className="glass-card p-4 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">累计验证</span>
              <p className="text-3xl font-black mono text-white">124</p>
            </div>
          </div>

          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">复盘矩阵 (小方块)</h3>
          <div className="grid grid-cols-4 gap-2 overflow-y-auto overflow-x-hidden">
            {Array.from({ length: 24 }).map((_, i) => (
              <div 
                key={i} 
                className={`aspect-square rounded-xl border border-white/5 flex items-center justify-center text-[10px] font-black ${
                  Math.random() > 0.3 ? 'bg-emerald-500/10 text-emerald-500/50' : 'bg-rose-500/10 text-rose-500/50'
                }`}
              >
                {24-i}D
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 单个跟踪信息卡片
 */
function TacticalCard({ data, stockName }: { data: HistoryRecord, stockName: string }) {
  const isUp = data.signal === 'Long';
  const isDown = data.signal === 'Short';

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start relative">
      {/* 内容主体 */}
      <div className="w-full max-w-md space-y-8">
        {/* Header区 */}
        <header className="flex flex-col items-center text-center space-y-2 pointer-events-none">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
              AI 跟踪记录 · {data.date}
            </span>
          </div>
          <h2 className="text-5xl font-black tracking-tighter" style={{ 
            color: isUp ? '#10b981' : isDown ? '#f43f5e' : '#f59e0b' 
          }}>
            {isUp ? '建议做多' : isDown ? '警惕风险' : '建议观望'}
          </h2>
          <p className="text-xs font-medium text-slate-500 tracking-[0.2em] uppercase">{stockName} · {data.title}</p>
        </header>

        {/* 核心理由卡片 */}
        <section className="glass-card p-6 border-white/10 relative overflow-hidden group active:scale-[0.99] transition-transform">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Zap className="w-12 h-12" />
          </div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Info size={14} className="text-indigo-500" /> 策略洞察
          </h3>
          <p className="text-base leading-relaxed text-slate-200 font-medium italic">
            &quot;{data.reason}&quot;
          </p>
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">关键支撑/止损</span>
              <p className="text-xl font-black mono text-white">{data.support.toFixed(2)}</p>
            </div>
            <div className="text-right">
               <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">建议关注度</span>
               <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= 4 ? 'bg-indigo-500' : 'bg-white/10'}`} />
                  ))}
               </div>
            </div>
          </div>
        </section>

        {/* 视觉提示：向上滑动看历史 */}
        {data.date === '今日' && (
          <div className="flex flex-col items-center gap-2 pt-10 animate-bounce opacity-30">
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">上划追溯历史轨迹</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 垂直信息流 (Y-axis - TikTok模式)
 */
function VerticalFeed({ stock }: { stock: Stock }) {
  return (
    <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
      {stock.history.map((record: HistoryRecord) => (
        <TacticalCard 
          key={record.date} 
          data={record} 
          stockName={stock.name} 
        />
      ))}
    </div>
  );
}

// --- 3. Main Page Body ---

export default function UXExperiment() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [profileStock, setProfileStock] = useState<Stock | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 处理横向滚动吸附后的索引更新
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.clientWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  return (
    <main className="fixed inset-0 bg-[#050508] text-white overflow-hidden select-none font-sans">
      {/* 动态背景辉光 */}
      <motion.div 
        animate={{ 
          backgroundColor: MOCK_DATA[currentIndex].color,
        }}
        className="fixed inset-0 opacity-[0.08] blur-[150px] pointer-events-none"
        style={{ scale: 1.5 }}
      />

      {/* 顶部通用 Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-8 flex items-center justify-between">
        <div className="flex items-center gap-3" onClick={() => setProfileStock(MOCK_DATA[currentIndex])}>
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group active:scale-95 transition-all cursor-pointer">
            <div className="text-xs font-black italic" style={{ color: MOCK_DATA[currentIndex].color }}>
              {MOCK_DATA[currentIndex].symbol.slice(-2)}
            </div>
          </div>
          <div className="cursor-pointer">
            <h1 className="text-sm font-black italic tracking-tighter transition-all group-hover:text-indigo-400">
              {MOCK_DATA[currentIndex].name}
              <span className="text-[10px] ml-2 text-slate-500 mono font-bold not-italic">{MOCK_DATA[currentIndex].symbol}</span>
            </h1>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="p-2.5 rounded-full bg-white/5 border border-white/10">
            <Menu className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </header>

      {/* 横向容器 (X-axis - Weather模式) */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide"
      >
        {MOCK_DATA.map((stock) => (
          <div key={stock.symbol} className="min-w-full h-full snap-center">
            <VerticalFeed 
              stock={stock} 
            />
          </div>
        ))}
      </div>

      {/* 底部导航/指示器 */}
      <footer className="fixed bottom-0 left-0 right-0 p-10 flex flex-col items-center gap-6 z-[100] pointer-events-none">
        {/* 页面圆点 */}
        <div className="flex gap-2">
          {MOCK_DATA.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-6 bg-white' : 'w-1 bg-white/20'
              }`} 
            />
          ))}
        </div>

        {/* 底部功能栏 */}
        <div className="w-full max-w-xs flex justify-between items-center pointer-events-auto">
           <button className="flex flex-col items-center gap-1 group">
              <div className="p-3 rounded-full bg-white/5 border border-white/10 group-active:scale-90 transition-all">
                <Grid className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-600 group-hover:text-indigo-400 transition-colors">股票池</span>
           </button>
           
           <div className="bg-indigo-500/10 border border-indigo-500/20 px-8 py-3 rounded-full">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">智能决策核心</span>
           </div>

           {/* 右侧留空或放置微小的设置入口，保持极简感 */}
           <div className="w-11" /> 
        </div>
      </footer>

      {/* 档案浮层 (Z-axis) */}
      <StockProfile 
        stock={profileStock || MOCK_DATA[0]} 
        isOpen={!!profileStock} 
        onClose={() => setProfileStock(null)} 
      />

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 32px;
        }
      `}</style>
    </main>
  );
}
