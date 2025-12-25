'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, Settings, Target, ShieldCheck, Zap, 
  ChevronRight, X as CloseIcon, Info, Grid, ChevronDown, 
  TrendingUp, TrendingDown, Minus, History
} from 'lucide-react';
import { DailyPrice, UserRule, AIPrediction } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { getIndicatorReviews } from '@/lib/analysis';
import { SettingsModal } from '@/components/SettingsModal';
import { getCurrentUser } from '@/lib/user';
import Link from 'next/link';

const COLORS = { 
  up: '#10b981', 
  down: '#f43f5e', 
  hold: '#f59e0b', 
  muted: '#64748b' 
};

// --- Types ---
interface Tactic { p: string; a: string; c: string; r: string; }
interface TacticalData {
  summary: string;
  tactics: { holding: Tactic[]; empty: Tactic[]; };
  conflict: string;
}

interface StockData {
  symbol: string;
  name: string;
  price: DailyPrice | null;
  prediction: AIPrediction | null;
  previousPrediction: AIPrediction | null;
  history: AIPrediction[];
  lastUpdated: string;
  rule: UserRule | null;
  loading: boolean;
}

// --- Sub-Components ---

function TacticalBriefDrawer({ 
  isOpen, onClose, data, userPos 
}: { isOpen: boolean; onClose: () => void; data: TacticalData; userPos: 'holding' | 'empty' | 'none'; }) {
  if (!isOpen || !data) return null;
  const tactics = data.tactics?.[userPos === 'none' ? 'empty' : userPos] || [];
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] p-8 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-20 duration-500 relative z-10">
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
        <header className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">智能决策核心</span>
            <h2 className="text-xl font-black italic tracking-tighter text-white">TACTICAL <span className="text-indigo-500">BRIEF</span></h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10 text-slate-400">
            <CloseIcon size={20} />
          </button>
        </header>
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 当前场景建议 ({userPos === 'holding' ? '已持仓' : '未建仓'})
            </h3>
            <div className="space-y-3">
              {tactics.map((t, idx) => (
                <div key={idx} className="glass-card p-4 border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded italic ${t.p === 'P1' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{t.p}</span>
                    <span className="text-sm font-bold text-white">{t.a}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">触发: <span className="text-slate-200">{t.c}</span></p>
                  <p className="text-xs text-slate-500 font-medium italic">理由: {t.r}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> 核心冲突处理原则</h3>
            <p className="text-sm text-indigo-300/70 leading-relaxed italic">{data.conflict || "遵循趋势优先原则。"}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function StockDashboardCard({ data, onShowTactics }: { data: StockData, onShowTactics: () => void }) {
  if (data.loading || !data.price) return <div className="h-full w-full flex items-center justify-center"><Zap className="w-12 h-12 text-slate-800 animate-pulse" /></div>;

  const reviews = getIndicatorReviews(data.price);
  const isTriggered = data.prediction?.support_price && data.price.close < data.prediction.support_price;

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start pt-32 pb-32">
      <div className="w-full max-w-md space-y-5">
        {/* 1. AI 顶层核心结论 */}
        <section className="text-center space-y-1 py-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">AI 实时监控 ({data.lastUpdated})</span>
          </div>
          <h2 className="text-4xl font-black tracking-tighter" style={{ 
            color: data.prediction?.signal === 'Long' ? COLORS.up : data.prediction?.signal === 'Short' ? COLORS.down : COLORS.hold 
          }}>
            {data.prediction?.signal === 'Long' ? '建议做多' : data.prediction?.signal === 'Short' ? '建议避灾' : '持仓观望'}
          </h2>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1 uppercase tracking-widest"><Target className="w-3 h-3" /> 置信度 {((data.prediction?.confidence || 0) * 100).toFixed(0)}%</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-800" />
            <span className="uppercase tracking-widest italic">{data.symbol}.HK</span>
          </div>
        </section>

        {/* 2. 当前价格与 AI 理由 */}
        <section 
          onClick={onShowTactics}
          className={`glass-card relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.04] ${isTriggered ? 'warning-pulse' : ''}`}
        >
          <div className="relative z-10 p-5">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 ai-pulse">
                  <Zap className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                </div>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI 深度洞察</h3>
              </div>
              
              <div className="space-y-4">
                {(() => {
                  try {
                    const tData = JSON.parse(data.prediction?.ai_reasoning || '') as TacticalData;
                    const userPos = data.rule?.position === 'holding' ? 'holding' : 'empty';
                    const p1 = tData.tactics?.[userPos]?.[0];
                    return (
                      <>
                        <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
                          &quot;{tData.summary || data.prediction?.ai_reasoning}&quot;
                        </p>
                        {p1 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-full overflow-hidden">
                          <span className="text-[9px] font-black bg-indigo-500 text-white px-1 py-0.5 rounded italic shrink-0">P1</span>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-indigo-400 shrink-0">{p1.a}:</span>
                            <span className="text-[10px] text-slate-400 font-medium truncate">{p1.c}</span>
                          </div>
                        </div>}
                      </>
                    );
                  } catch {
                    return <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">&quot;{data.prediction?.ai_reasoning || '正在评估行情...'}&quot;</p>;
                  }
                })()}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <span className="text-[10px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">当前成交价</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black mono tracking-tight">{data.price.close.toFixed(2)}</span>
                  <span className="text-[10px] font-bold" style={{ color: data.price.change_percent >= 0 ? COLORS.up : COLORS.down }}>
                    {data.price.change_percent >= 0 ? '+' : ''}{data.price.change_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-600 uppercase font-black tracking-widest block mb-1">昨日验证</span>
                <div className="flex items-center justify-end gap-1.5 font-bold text-[11px]">
                  {data.previousPrediction?.validation_status === 'Correct' ? <span className="text-emerald-500/80 flex items-center gap-1"><ShieldCheck size={12} /> 结果准确</span> :
                   data.previousPrediction?.validation_status === 'Incorrect' ? <span className="text-rose-500/80">❌ 偏差回顾</span> : <span className="text-slate-600 italic">待验证</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 底部信息块 */}
        <section className="grid grid-cols-2 gap-4 pb-2">
           <div className="glass-card p-4 flex flex-col justify-between">
              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{data.rule?.position === 'holding' ? '止损预警' : '策略支撑'}</span>
              <p className="text-xl font-black mono text-rose-500/90 mt-1">{data.prediction?.support_price?.toFixed(2) || '--'}</p>
           </div>
           <div className="glass-card p-4 flex flex-col justify-between">
              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">市场情绪 (RSI)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xl font-black mono">{data.price.rsi.toFixed(0)}</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-600 whitespace-nowrap">{data.price.rsi > 70 ? '超买' : data.price.rsi < 30 ? '超卖' : '运行稳健'}</span>
              </div>
           </div>
        </section>

        {data.history.length > 1 && (
          <div className="flex flex-col items-center gap-1.5 pt-2 opacity-20">
            <span className="text-[8px] font-black tracking-[0.2em] text-slate-500 uppercase">上划追溯历史轨迹</span>
            <ChevronDown size={14} className="animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}

function VerticalIndicator({ container, onScroll }: { container: HTMLDivElement | null, onScroll?: (top: number) => void }) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const total = scrollHeight - clientHeight;
      if (total > 0) setProgress(scrollTop / total);
      
      if (onScroll) onScroll(scrollTop);

      setIsVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsVisible(false), 1500);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [container, onScroll]);

  return (
    <div className="sticky top-0 h-0 w-full z-[100] pointer-events-none">
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            transition={{ duration: 0.2 }}
            className="absolute right-1 top-1/3 bottom-1/3 w-0.5 bg-white/5 rounded-full"
          >
            <motion.div 
              className="absolute left-0 right-0 bg-white/30 rounded-full"
              style={{ 
                height: '20%', 
                top: `${progress * 80}%`
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function HistoricalCard({ data }: { data: AIPrediction }) {
  const isUp = data.signal === 'Long';
  const isDown = data.signal === 'Short';
  
  // 尝试解析 JSON 理由
  let displayReason = data.ai_reasoning;
  try {
    const parsed = JSON.parse(data.ai_reasoning);
    displayReason = parsed.summary || data.ai_reasoning;
  } catch (e) {
    // 如果不是 JSON，则保持原样
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start">
      <div className="w-full max-w-md glass-card p-8 border-white/5 relative overflow-hidden active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3 mb-8">
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 tracking-widest mono uppercase">
            {data.date}
          </div>
          <div className="h-px flex-1 bg-white/5" />
          <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
            data.validation_status === 'Correct' ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {data.validation_status === 'Correct' ? <><ShieldCheck size={12} /> 准确</> : <><TrendingDown size={12} /> 偏离回顾</>}
          </div>
        </div>

        <h3 className="text-3xl font-black italic mb-6 tracking-tighter" style={{ color: isUp ? COLORS.up : isDown ? COLORS.down : COLORS.hold }}>
          {isUp ? '看多方向' : isDown ? '风险回避' : '持仓待机'}
        </h3>
        
        <p className="text-base text-slate-300 leading-relaxed italic mb-10 font-medium">
          &quot;{displayReason.length > 80 ? displayReason.slice(0, 80) + '...' : displayReason}&quot;
        </p>

        <div className="grid grid-cols-2 pt-8 border-t border-white/5">
           <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1 tracking-widest">建议参考价</span>
              <p className="text-2xl font-black mono text-white">{data.support_price?.toFixed(2) || '--'}</p>
           </div>
           <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1 tracking-widest">实盘变动</span>
              <p className={`text-xl font-black mono ${data.actual_change && data.actual_change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {data.actual_change ? (data.actual_change >= 0 ? '+' : '') + data.actual_change.toFixed(2) + '%' : '已结算'}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function StockVerticalFeed({ stock, onShowTactics, onVerticalScroll, scrollRequest }: { 
  stock: StockData, 
  onShowTactics: () => void, 
  onVerticalScroll: (top: number) => void,
  scrollRequest?: number // 用于外部请求滚动回顶部的逻辑
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  
  // 监听回顶请求
  useEffect(() => {
    if (container && scrollRequest !== undefined) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [container, scrollRequest]);

  return (
    <div 
      ref={setContainer}
      className="min-w-full h-full relative snap-center overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
    >
      <VerticalIndicator container={container} onScroll={onVerticalScroll} />
      {/* Y轴 垂直内容 (TikTok Mode) */}
      <StockDashboardCard data={stock} onShowTactics={onShowTactics} />
      {stock.history.slice(1).map((h, i) => <HistoricalCard key={i} data={h} />)}
    </div>
  );
}

function StockProfile({ stock, isOpen, onClose }: { stock: StockData | null, isOpen: boolean, onClose: () => void }) {
  if (!stock) return null; // 渲染守护

  const winCount = stock.history?.filter(h => h.validation_status === 'Correct').length || 0;
  const totalCount = stock.history?.filter(h => h.validation_status !== 'Pending').length || 0;
  const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[200] bg-[#050508] p-6 flex flex-col pointer-events-auto"
        >
          <button onClick={onClose} className="mb-8 p-3 w-fit rounded-full bg-white/5 border border-white/10">
            <CloseIcon className="w-5 h-5 text-slate-400" />
          </button>
          
          <div className="flex items-center gap-4 mb-10">
            <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-black italic text-indigo-500">
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
              <p className="text-3xl font-black mono text-emerald-500">{winRate}%</p>
            </div>
            <div className="glass-card p-4 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">累计验证</span>
              <p className="text-3xl font-black mono text-white">{totalCount}</p>
            </div>
          </div>

          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">复盘矩阵 (最近 30 天)</h3>
          <div className="grid grid-cols-4 gap-2 overflow-y-auto overflow-x-hidden">
            {stock.history.map((h, i) => (
              <div 
                key={i} 
                className={`aspect-square rounded-xl border border-white/5 flex items-center justify-center text-[10px] font-black ${
                  h.validation_status === 'Correct' ? 'bg-emerald-500/10 text-emerald-500/50' : 
                  h.validation_status === 'Incorrect' ? 'bg-rose-500/10 text-rose-500/50' : 'bg-white/5 text-slate-700'
                }`}
              >
                {h.date.split('-').slice(1).join('/')}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Main Page ---

function DashboardPageContent() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingPool, setLoadingPool] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTactics, setShowTactics] = useState<string | null>(null);
  const [profileStock, setProfileStock] = useState<StockData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadAllData = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) return;

    try {
      const poolRes = await fetch(`/api/stock-pool?userId=${user.userId}`);
      const poolData = await poolRes.json();
      const watchlist = poolData.stocks || [{ symbol: '02171', name: '科济药业' }];

      const initialStocks = watchlist.map((s: { symbol: string; name: string }) => ({
        symbol: s.symbol,
        name: s.name,
        price: null, prediction: null, previousPrediction: null, history: [],
        lastUpdated: '--:--', rule: getRule(s.symbol), loading: true
      }));
      setStocks(initialStocks);
      setLoadingPool(false);

      // 并行请求每只股票的数据
      initialStocks.forEach(async (stock: StockData) => {
        try {
          const [stockRes, historyRes] = await Promise.all([
            fetch(`/api/stock?symbol=${stock.symbol}`),
            fetch(`/api/predictions?symbol=${stock.symbol}&limit=5`)
          ]);
          const sData = await stockRes.json();
          const hData = await historyRes.json();

          setStocks(prev => prev.map(p => p.symbol === stock.symbol ? {
            ...p,
            price: sData.price,
            prediction: sData.prediction,
            previousPrediction: sData.previousPrediction,
            lastUpdated: sData.last_update_time || '--:--',
            history: hData.predictions || [],
            loading: false
          } : p));
        } catch (e) {
          console.error(`Failed to load ${stock.symbol}`, e);
        }
      });
    } catch (e) {
      console.error(e);
      setLoadingPool(false);
    }
  }, []);

  const [yScrollPosition, setYScrollPosition] = useState(0);
  const [backToTopCounter, setBackToTopCounter] = useState(0);

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.clientWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== currentIndex) setCurrentIndex(newIndex);
  };

  if (loadingPool) return <div className="min-h-screen bg-[#050508] flex items-center justify-center text-slate-500 text-xs font-bold tracking-widest animate-pulse">核心系统初始化中...</div>;

  const currentStock = stocks[currentIndex];

  return (
    <main className="fixed inset-0 bg-[#050508] text-white overflow-hidden select-none font-sans">
      {/* 动态背景辉光 */}
      <AnimatePresence>
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 pointer-events-none"
          style={{ 
            backgroundColor: currentStock?.prediction?.signal === 'Long' ? '#6366f1' : 
                            currentStock?.prediction?.signal === 'Short' ? '#f43f5e' : '#f59e0b',
            filter: 'blur(150px)', scale: 1.5
          }}
        />
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-8 flex items-center justify-between pointer-events-none">
        <Link href="/stock-pool" className="pointer-events-auto p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-95 transition-all">
          <Grid className="w-5 h-5 text-indigo-400" />
        </Link>
        <div className="flex gap-4 pointer-events-auto">
           <button onClick={() => setSettingsOpen(true)} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90"><Settings className="w-4 h-4 text-slate-400" /></button>
        </div>
      </header>

      {/* X轴 监控容器 (Weather Mode) */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide"
      >
        {stocks.map((stock) => (
          <StockVerticalFeed 
            key={stock.symbol} 
            stock={stock} 
            onShowTactics={() => setShowTactics(stock.symbol)} 
            onVerticalScroll={(top) => setYScrollPosition(top)}
            scrollRequest={currentIndex === stocks.indexOf(stock) ? backToTopCounter : undefined}
          />
        ))}
      </div>

      {/* 底部导航 */}
      <footer className="fixed bottom-0 left-0 right-0 p-10 px-8 flex flex-col items-center gap-6 z-[100] pointer-events-none">
        <div className="flex gap-2">
          {stocks.map((_, idx) => (
            <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
          ))}
        </div>
        <div className="w-full flex justify-between items-center pointer-events-auto">
           {/* 现在入口移到了左下角，方便大拇指点击 */}
           <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => setProfileStock(currentStock)}>
              <div className="w-11 h-11 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center transition-all group-active:scale-90 group-hover:bg-white/10">
                 <div className="text-[10px] font-black italic text-indigo-500">{currentStock?.symbol.slice(-2)}</div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black italic group-hover:text-indigo-400 transition-colors">{currentStock?.name}</span>
                <span className="text-[9px] text-slate-600 font-bold mono">{currentStock?.symbol}</span>
              </div>
           </div>

           {/* 中间的动态按钮：上划后显示“回到今天” */}
           <AnimatePresence>
             {yScrollPosition > 100 && (
               <motion.button 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 20 }}
                 onClick={() => setBackToTopCounter(prev => prev + 1)}
                 className="flex items-center bg-white/5 border border-white/10 px-5 py-2.5 rounded-full shadow-lg active:scale-90 transition-all pointer-events-auto"
               >
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">回到今天</span>
               </motion.button>
             )}
           </AnimatePresence>

           <div className="w-11" />
        </div>
      </footer>

      {/* Modals & Drawers */}
      <SettingsModal 
        symbol={currentStock?.symbol || '02171'} 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        onSave={() => loadAllData()} 
      />
      <StockProfile 
        stock={profileStock} 
        isOpen={!!profileStock} 
        onClose={() => setProfileStock(null)} 
      />

      {stocks.map(s => {
        try {
          const tData = JSON.parse(s.prediction?.ai_reasoning || '') as TacticalData;
          return <TacticalBriefDrawer 
            key={s.symbol} 
            isOpen={showTactics === s.symbol} 
            onClose={() => setShowTactics(null)} 
            data={tData} 
            userPos={s.rule?.position || 'none'} 
          />
        } catch { return null; }
      })}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 32px; }
        @keyframes warning-pulse { 0%, 100% { border-color: rgba(255, 255, 255, 0.05); } 50% { border-color: rgba(244, 63, 94, 0.3); background: rgba(244, 63, 94, 0.02); } }
        .warning-pulse { animation: warning-pulse 2s infinite; }
      `}</style>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}
