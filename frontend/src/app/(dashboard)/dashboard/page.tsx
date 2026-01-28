'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid as Grid, ChevronDown, RefreshCw, User, FileText } from 'lucide-react';
import { StockData, AIPrediction } from '@/lib/types';
import { 
  TacticalBriefDrawer, 
  StockProfile,
  StockVerticalFeed,
  BriefDrawer,
  COLORS 
} from '@/components/dashboard';
import { formatStockSymbol } from '@/lib/date-utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useTikTokScroll } from '@/hooks/useTikTokScroll';

import { useUserProfile } from '@/hooks/useUserProfile';

const UserCenterDrawer = dynamic(() => import('@/components/UserCenterDrawer'), {
  ssr: false,
  loading: () => null
});

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetSymbol = searchParams.get('symbol');
  const [userCenterOpen, setUserCenterOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const hasScrolledToTarget = useRef(false);

  const { stocks, loadingPool, refresh, isRefreshing, loadMoreHistory } = useDashboardData();
  const {
    currentIndex,
    scrollRef,
    handleScroll,
    yScrollPosition,
    handleVerticalScroll,
    backToTopCounter,
    scrollToToday
  } = useTikTokScroll(stocks, {
    onOverscrollRight: () => setUserCenterOpen(true),
    // 简化交互：左边缘右滑直接进入更完整的"监控池页面"，替代原本的简易浮层
    onOverscrollLeft: () => router.push('/dashboard/stock-pool')
  });

  const [selectedTactics, setSelectedTactics] = useState<{ symbol: string; prediction: AIPrediction } | null>(null);
  const [profileStock, setProfileStock] = useState<StockData | null>(null);
  const { tier } = useUserProfile();

  // 进入 App 时清除角标 (小红点)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).clearAppBadge().catch(console.error);
    }
  }, []);

  // 深度链接: 从 URL 参数滚动到指定股票 (通知点击跳转)
  useEffect(() => {
    if (targetSymbol && stocks.length > 0 && scrollRef.current && !hasScrolledToTarget.current) {
      const targetIndex = stocks.findIndex(s => s.symbol === targetSymbol || s.symbol.endsWith(targetSymbol));
      if (targetIndex > 0) {
        // 滚动到目标股票
        const cardWidth = scrollRef.current.offsetWidth;
        scrollRef.current.scrollTo({ left: targetIndex * cardWidth, behavior: 'smooth' });
        hasScrolledToTarget.current = true;
      }
    }
  }, [targetSymbol, stocks, scrollRef]);

  // 深度链接: 从 URL 参数打开简报
  useEffect(() => {
    if (searchParams.get('brief') === 'true') {
      setBriefOpen(true);
    }
  }, [searchParams]);

  if (loadingPool && stocks.length === 0) {
    return (
      <div className="min-h-screen bg-[#050508] relative overflow-hidden">
        {/* Skeleton Header */}
        <div className="flex justify-between p-6">
          <div className="w-10 h-10 rounded-[16px] bg-white/5 animate-pulse" />
          <div className="flex flex-col items-center gap-2">
            <div className="w-32 h-6 bg-white/5 rounded animate-pulse" />
            <div className="w-16 h-3 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 rounded-[16px] bg-white/5 animate-pulse" />
        </div>

        {/* Skeleton Card */}
        <div className="px-6 mt-10 space-y-4">
           {/* Card Body */}
           <div className="w-full aspect-[3/4] rounded-[32px] bg-white/5 border border-white/5 p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent animate-shimmer" />
              
              <div className="space-y-6">
                 <div className="w-16 h-16 rounded-2xl bg-white/10" />
                 <div className="w-3/4 h-8 bg-white/10 rounded" />
                 <div className="w-1/2 h-4 bg-white/5 rounded" />
              </div>
           </div>
        </div>
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

      {/* Header - 极简刷新按钮 + 居中股票名称 */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-6 pointer-events-none">
        <div className="w-full flex justify-between items-start pointer-events-auto">
           {/* 左侧：点击打开股票档案 (无代码显示) */}
           <div className="flex items-center gap-2 cursor-pointer group shrink-0" onClick={() => setProfileStock(currentStock)}>
              <div className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center transition-all group-active:scale-90 group-hover:bg-white/10">
                 <div className="text-[10px] font-black italic text-indigo-500">{currentStock?.symbol.slice(-2)}</div>
              </div>
           </div>

          {/* 中央：股票名称突出显示 */}
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 top-6 cursor-pointer group flex flex-col items-center"
            onClick={() => setProfileStock(currentStock)}
          >
            <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center">
              {currentStock?.name}
            </h1>
            <span className="text-[10px] font-black italic text-slate-500 tracking-widest uppercase mt-0.5">
              {currentStock ? formatStockSymbol(currentStock.symbol) : ''}
            </span>
          </div>

          {/* 右侧：Brief 入口 (替代刷新) */}
          <button 
            onClick={() => setBriefOpen(true)}
            className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-white/10 group"
          >
            <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
          </button>
        </div>
      </header>

      {/* X轴 监控容器 (Weather Mode) */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide transition-opacity duration-300 ${(profileStock || userCenterOpen) ? 'opacity-40 pointer-events-none touch-none' : 'opacity-100'}`}
      >
        {stocks.map((stock, idx) => (
          <StockVerticalFeed 
            key={stock.symbol} 
            stock={stock} 
            onShowTactics={(prediction) => setSelectedTactics({ symbol: stock.symbol, prediction })} 
            onVerticalScroll={handleVerticalScroll}
            scrollRequest={currentIndex === idx ? backToTopCounter : undefined}
            onLoadMore={loadMoreHistory}
          />
        ))}
      </div>

      {/* 底部导航 - Stock Pool + 个人中心 */}
      <footer className="fixed bottom-0 left-0 right-0 p-10 px-8 flex flex-col items-center gap-6 z-[100] pointer-events-none">
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

        <div className="flex gap-2">
          {stocks.map((_, idx) => (
            <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
          ))}
        </div>
        <div className="w-full flex justify-between items-center pointer-events-auto">
          <Link href="/dashboard/stock-pool" className="p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-95 transition-all">
            <Grid className="w-5 h-5 text-indigo-400" />
          </Link>
          
          <button 
            onClick={() => setUserCenterOpen(true)} 
            className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/10 shrink-0"
          >
            <User className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <TacticalBriefDrawer 
        isOpen={!!selectedTactics} 
        onClose={() => setSelectedTactics(null)} 
        tier={tier}
        data={(() => {
          try {
            return JSON.parse(selectedTactics?.prediction?.ai_reasoning || '{}');
          } catch {
            return {};
          }
        })()}
        userPos={stocks.find(s => s.symbol === selectedTactics?.symbol)?.rule?.position || 'none'}
        model={selectedTactics?.prediction?.model}
        symbol={selectedTactics?.symbol || ''}
        targetDate={selectedTactics?.prediction?.target_date || ''}
      />

      <StockProfile 
        stock={profileStock}
        isOpen={!!profileStock}
        onClose={() => setProfileStock(null)}
      />

      <UserCenterDrawer 
        isOpen={userCenterOpen}
        onClose={() => setUserCenterOpen(false)}
      />

      <BriefDrawer 
        isOpen={briefOpen}
        onClose={() => setBriefOpen(false)}
        limitToSymbol={currentStock?.symbol}
        onUpgrade={() => setUserCenterOpen(true)}
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
