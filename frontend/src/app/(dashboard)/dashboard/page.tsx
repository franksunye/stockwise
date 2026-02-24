'use client';

import { useState, useEffect, Suspense, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid as Grid, ChevronDown, User, FileText, Share2, Copy } from 'lucide-react';
import { StockData, AIPrediction } from '@/lib/types';
import { 
  StockVerticalFeed,
  BriefDrawer,
  COLORS,
  MarketAlmanacFeed,
  type MarketAlmanacHandle
} from '@/components/dashboard';
import { formatStockSymbol } from '@/lib/date-utils';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useStocks } from '@/context/StockContext';
import { useTikTokScroll } from '@/hooks/useTikTokScroll';

import { useUserProfile } from '@/hooks/useUserProfile';

const UserCenterDrawer = dynamic(() => import('@/components/UserCenterDrawer'), {
  ssr: false,
  loading: () => null
});

const StockProfile = dynamic(() => import('@/components/dashboard/StockProfile').then(mod => mod.StockProfile), {
  ssr: false,
  loading: () => null
});

const TacticalBriefDrawer = dynamic(() => import('@/components/dashboard/TacticalBriefDrawer').then(mod => mod.TacticalBriefDrawer), {
  ssr: false,
  loading: () => null
});

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // const targetSymbol = searchParams.get('symbol');
  const [userCenterOpen, setUserCenterOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const almanacRef = useRef<MarketAlmanacHandle>(null);
  // const hasScrolledToTarget = useRef(false);

  const { stocks, almanac, almanacs, loadingPool, loadMoreHistory } = useStocks();

  // Create an extended array where the first items are the Market Almanacs (multi-day flipping)
  // 保持索引稳定：无论黄历加载与否，黄历占位符永远位于 Index 0，防止 Index 漂移
  const displayStocks = useMemo(() => {
    const almanacList = almanacs.length > 0 ? almanacs : (almanac ? [almanac] : []);
    
    // 强制占位 Index 0
    const almanacCard = {
      symbol: `MARKET_ALMANAC`,
      name: 'ZISO AI · 投资黄历',
      prediction: { signal: 'Almanac' },
      isAlmanac: true,
      almanacData: almanacList
    } as unknown as StockData;

    return [
      almanacCard,
      ...stocks
    ];
  }, [stocks, almanacs, almanac]);

  const scrollOptions = useMemo(() => ({
    onOverscrollRight: () => setUserCenterOpen(true),
    // 简化交互：左边缘右滑直接进入更完整的"监控池页面"，替代原本的简易浮层
    onOverscrollLeft: () => router.push('/dashboard/stock-pool')
  }), [router]);

  const {
    currentIndex,
    scrollRef,
    handleScroll,
    yScrollPosition,
    handleVerticalScroll,
    backToTopCounter,
    scrollToToday
  } = useTikTokScroll(displayStocks, scrollOptions);

  const [selectedTactics, setSelectedTactics] = useState<{ symbol: string; prediction: AIPrediction } | null>(null);
  const [profileStock, setProfileStock] = useState<StockData | null>(null);
  const { tier } = useUserProfile();

  // Stable handlers for Feed to prevent re-renders
  const handleShowTactics = useCallback((symbol: string, prediction: AIPrediction) => {
    setSelectedTactics({ symbol, prediction });
  }, []);

  const handleVerticalScrollStable = useCallback((top: number, index: number) => {
    handleVerticalScroll(top, index);
  }, [handleVerticalScroll]);

  // 进入 App 时清除角标 (小红点)
  useEffect(() => {
    interface ExtendedNavigator {
      clearAppBadge?: () => Promise<void>;
    }
    const nav = navigator as ExtendedNavigator;
    if (typeof nav !== 'undefined' && nav.clearAppBadge) {
      nav.clearAppBadge().catch(console.error);
    }
  }, []);

  // 深度链接: 从 URL 参数打开简报
  useEffect(() => {
    if (searchParams.get('brief') === 'true') {
      setBriefOpen(true);
    }
  }, [searchParams]);

  const currentStock = displayStocks[currentIndex];
  const isMarketAlmanac = currentStock && 'isAlmanac' in currentStock && currentStock.isAlmanac;

  return (
    <main className="fixed inset-0 bg-[#050508] text-white overflow-hidden select-none font-sans">
      {/* 动态背景辉光: 使用径向渐变代替原生 blur，极大降低 iOS 上的 GPU/渲染负担 */}
      <motion.div 
        animate={{ opacity: 0.15 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 pointer-events-none scale-150"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${
            isMarketAlmanac ? '#4F46E5' : // Indigo
            currentStock?.prediction?.signal === 'Long' ? COLORS.up : 
            currentStock?.prediction?.signal === 'Short' ? COLORS.down : COLORS.hold
          } 0%, transparent 70%)`
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-6 pointer-events-none">
        <div className="w-full flex justify-between items-start pointer-events-auto">
           {/* 左侧：点击打开股票档案 / 分享（黄历） */}
           <div 
             className="flex items-center gap-2 cursor-pointer group shrink-0" 
             onClick={() => {
               if (isMarketAlmanac) {
                 almanacRef.current?.share();
               } else {
                 setProfileStock(currentStock);
               }
             }}
           >
              <div className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center transition-all group-active:scale-90 group-hover:bg-white/10 overflow-hidden relative">
                 <motion.div
                   animate={{ 
                     opacity: 1, 
                     scale: 1,
                     rotate: isMarketAlmanac ? 0 : 0 
                   }}
                   key={isMarketAlmanac ? 'almanac-left' : 'stock-left'}
                   initial={{ opacity: 0, scale: 0.8 }}
                   className="absolute inset-0 flex items-center justify-center"
                 >
                   {isMarketAlmanac ? (
                     <Share2 className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
                   ) : (
                     <div className="text-[10px] font-black italic text-indigo-500">{currentStock?.symbol?.slice(-2) || ''}</div>
                   )}
                 </motion.div>
              </div>
           </div>

          {/* 中央：股票名称突出显示 / 市场黄历标题 */}
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 top-4 cursor-pointer group flex flex-col items-center h-12 justify-center"
            onClick={() => !isMarketAlmanac && setProfileStock(currentStock)}
          >
            <div className={`flex flex-col items-center transition-opacity duration-300 ${isMarketAlmanac ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}>
               <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center drop-shadow-md">
                 ZISO AI · 投资黄历
               </h1>
            </div>
            
            <div className={`flex flex-col items-center transition-opacity duration-300 ${!isMarketAlmanac ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}>
               <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center">
                 {currentStock?.name}
               </h1>
               <span className="text-[10px] font-black italic text-slate-500 tracking-widest uppercase mt-0.5 leading-none">
                 {currentStock ? formatStockSymbol(currentStock.symbol) : ''}
               </span>
            </div>
          </div>

          {/* 右侧：Brief 入口 / 复制（黄历） */}
          <button 
            onClick={() => {
              if (isMarketAlmanac) {
                almanacRef.current?.copy();
              } else {
                setBriefOpen(true);
              }
            }}
            className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-white/10 group overflow-hidden relative"
          >
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isMarketAlmanac ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}>
              <Copy className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            </div>
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${!isMarketAlmanac ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}>
              <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            </div>
          </button>
        </div>
      </header>

      {/* X轴 监控容器 (Weather Mode) */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide"
      >
        {displayStocks.map((stock, idx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ('isAlmanac' in stock && (stock as any).isAlmanac) {
            return (
              <MarketAlmanacFeed 
                ref={almanacRef}
                key={stock.symbol} 
                index={idx}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data={(stock as any).almanacData}
                onVerticalScroll={handleVerticalScrollStable} 
                scrollRequest={backToTopCounter}
              />
            );
          }
          return (
            <StockVerticalFeed 
              key={stock.symbol} 
              index={idx}
              stock={stock} 
              onShowTactics={handleShowTactics} 
              onVerticalScroll={handleVerticalScrollStable}
              scrollRequest={backToTopCounter}
              onLoadMore={loadMoreHistory}
            />
          );
        })}
      </div>

      {/* 底部导航 - Stock Pool + 个人中心 */}
      <footer className="fixed bottom-0 left-0 right-0 pt-10 px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-6 z-[100] pointer-events-none">
        <AnimatePresence>
          {yScrollPosition > 100 && (
            <motion.button 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={() => {
                scrollToToday();
                if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                  window.navigator.vibrate(10); // Subtle haptic buzz
                }
              }}
              className="flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-full shadow-[0_10px_30px_rgba(99,102,241,0.3)] active:scale-90 transition-all pointer-events-auto"
            >
              <ChevronDown className="w-4 h-4 rotate-180" />
              <span className="text-[10px] font-black uppercase tracking-widest">回到今天</span>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          {displayStocks.map((_, idx) => (
            <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
          ))}
        </div>
        <div className="w-full flex justify-between items-center pointer-events-auto">
          <Link 
            href="/dashboard/stock-pool" 
            prefetch={true}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-95 transition-all pointer-events-auto inline-flex items-center justify-center cursor-pointer touch-manipulation"
          >
            <Grid className="w-5 h-5 text-indigo-400" />
          </Link>
          
          <button 
            onClick={() => setUserCenterOpen(true)} 
            className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/10 shrink-0 cursor-pointer touch-manipulation"
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
        signal={selectedTactics?.prediction?.signal}
        confidence={selectedTactics?.prediction?.confidence}
        stockName={stocks.find(s => s.symbol === selectedTactics?.symbol)?.name}
      />

      <AnimatePresence>
        {profileStock && (
          <StockProfile 
            stock={profileStock}
            onClose={() => setProfileStock(null)}
          />
        )}
      </AnimatePresence>

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
