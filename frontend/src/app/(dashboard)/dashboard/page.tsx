'use client';

import { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid as Grid, Settings, ChevronDown, RefreshCw } from 'lucide-react';
import { StockData } from '@/lib/types';
import { 
  TacticalBriefDrawer, 
  StockProfile,
  StockVerticalFeed,
  COLORS 
} from '@/components/dashboard';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useTikTokScroll } from '@/hooks/useTikTokScroll';

const SettingsModal = dynamic(() => import('@/components/SettingsModal').then(mod => mod.SettingsModal), {
  ssr: false,
  loading: () => null
});

// 格式化倒计时
function formatCountdown(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function DashboardContent() {
  const { stocks, loadingPool, refresh, isRefreshing, nextRefreshIn } = useDashboardData();
  const {
    currentIndex,
    scrollRef,
    handleScroll,
    yScrollPosition,
    handleVerticalScroll,
    backToTopCounter,
    scrollToToday
  } = useTikTokScroll(stocks);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTactics, setShowTactics] = useState<string | null>(null);
  const [profileStock, setProfileStock] = useState<StockData | null>(null);

  if (loadingPool) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center text-slate-500 text-xs font-bold tracking-widest animate-pulse">
        核心系统初始化中...
      </div>
    );
  }

  const currentStock = stocks[currentIndex];

  return (
    <main className="fixed inset-0 bg-[#050508] text-white overflow-hidden select-none font-sans">
      {/* 动态背景辉光 */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 pointer-events-none"
          style={{ 
            backgroundColor: currentStock?.prediction?.signal === 'Long' ? COLORS.up : 
                            currentStock?.prediction?.signal === 'Short' ? COLORS.down : COLORS.hold,
            filter: 'blur(150px)', 
            scale: 1.5
          }}
        />
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-8 pointer-events-none">
        <div className="flex justify-between items-center w-full">
          <Link href="/dashboard/stock-pool" className="pointer-events-auto p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-95 transition-all">
            <Grid className="w-5 h-5 text-indigo-400" />
          </Link>
          
          {/* 刷新指示器 */}
          <button 
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-bold text-slate-500 mono tabular-nums">
              {isRefreshing ? '刷新中' : formatCountdown(nextRefreshIn)}
            </span>
          </button>
        </div>
      </header>

      {/* X轴 监控容器 (Weather Mode) */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide transition-opacity duration-300 ${(profileStock || settingsOpen) ? 'opacity-40 pointer-events-none touch-none' : 'opacity-100'}`}
      >
        {stocks.map((stock, idx) => (
          <StockVerticalFeed 
            key={stock.symbol} 
            stock={stock} 
            onShowTactics={() => setShowTactics(stock.symbol)} 
            onVerticalScroll={handleVerticalScroll}
            scrollRequest={currentIndex === idx ? backToTopCounter : undefined}
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
           <div className="flex items-center gap-3 cursor-pointer group shrink-0" onClick={() => setProfileStock(currentStock)}>
              <div className="w-11 h-11 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center transition-all group-active:scale-90 group-hover:bg-white/10">
                 <div className="text-[10px] font-black italic text-indigo-500">{currentStock?.symbol.slice(-2)}</div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-black italic group-hover:text-indigo-400 transition-colors uppercase">{currentStock?.name}</span>
                <span className="text-[9px] text-slate-600 font-bold mono">{currentStock?.symbol}.HK</span>
              </div>
           </div>

           <AnimatePresence>
             {yScrollPosition > 100 && (
               <motion.button 
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: 20 }}
                 onClick={scrollToToday}
                 className="flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-full shadow-[0_10px_30px_rgba(99,102,241,0.3)] active:scale-90 transition-all pointer-events-auto"
               >
                 <ChevronDown className="w-4 h-4 rotate-180" />
                 <span className="text-[10px] font-black uppercase tracking-widest">回到今天</span>
               </motion.button>
             )}
           </AnimatePresence>

           <button 
             onClick={() => setSettingsOpen(true)} 
             className="w-11 h-11 rounded-[18px] bg-white/5 border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/10 shrink-0"
           >
             <Settings className="w-5 h-5 text-slate-400" />
           </button>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <TacticalBriefDrawer 
        isOpen={!!showTactics} 
        onClose={() => setShowTactics(null)} 
        data={JSON.parse(stocks.find(s => s.symbol === showTactics)?.prediction?.ai_reasoning || '{}')}
        userPos={stocks.find(s => s.symbol === showTactics)?.rule?.position || 'none'}
      />

      <StockProfile 
        stock={profileStock}
        isOpen={!!profileStock}
        onClose={() => setProfileStock(null)}
      />

      <SettingsModal 
        symbol={currentStock?.symbol || ''}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={refresh}
      />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
