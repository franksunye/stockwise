'use client';

import { useState, useEffect, Suspense, useRef, useCallback, useMemo, memo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid as Grid, ChevronDown, User, FileText, Share2, Copy } from 'lucide-react';
import { StockData, AIPrediction, MarketAlmanacData } from '@/lib/types';
import { 
  StockVerticalFeed,
  BriefDrawer,
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
import { getPredictionActionMeta } from '@/lib/layer1-ui';

const DASHBOARD_NAV_INTENT_KEY = 'stockwise_dashboard_nav_intent';

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

let aiCouncilPreloadModulePromise: Promise<typeof import('@/components/dashboard/AICouncil')> | null = null;

function preloadCouncil(symbol?: string, targetDate?: string) {
  if (!symbol || !targetDate) return;
  aiCouncilPreloadModulePromise ??= import('@/components/dashboard/AICouncil');
  void aiCouncilPreloadModulePromise
    .then(({ preloadAICouncil }) => {
      preloadAICouncil(symbol, targetDate);
    })
    .catch(() => {
      // Non-critical: this only affects first-open smoothness.
    });
}

// 扩展类型以包含黄历特有字段，消除 lint 错误
interface ExtendedStockData extends StockData {
  isAlmanac?: boolean;
  almanacData?: MarketAlmanacData | MarketAlmanacData[];
}

// 1. 性能组件：独立背景辉光 (隔离 Modal 开关带来的重绘)
const DashboardBackground = memo(({ isAlmanac, prediction }: { isAlmanac: boolean, prediction?: AIPrediction | null }) => {
  const color = useMemo(() => {
    if (isAlmanac) return '#4F46E5';
    return getPredictionActionMeta(prediction).color;
  }, [isAlmanac, prediction]);

  return (
    <motion.div 
      initial={false}
      animate={{ opacity: 0.15 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 pointer-events-none scale-150"
      style={{
        background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 70%)`
      }}
    />
  );
});
DashboardBackground.displayName = 'DashboardBackground';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userCenterOpen, setUserCenterOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const almanacRef = useRef<MarketAlmanacHandle>(null);

  const { stocks, almanac, almanacs, loadMoreHistory } = useStocks();

  // Create an extended array where the first items are the Market Almanacs
  const displayStocks = useMemo(() => {
    const almanacList = almanacs.length > 0 ? almanacs : (almanac ? [almanac] : []);
    const almanacCard: ExtendedStockData = {
      symbol: `MARKET_ALMANAC`,
      name: 'ZISO AI · 投资黄历',
      prediction: { 
        signal: 'Almanac',
        symbol: 'MARKET_ALMANAC',
        date: '',
        target_date: '',
        confidence: 1,
        support_price: 0,
        ai_reasoning: '',
        validation_status: 'Pending',
        actual_change: null
      } as unknown as AIPrediction,
      isAlmanac: true,
      almanacData: almanacList,
      // 填充 StockData 必需字段
      price: null,
      previousPrediction: null,
      history: [],
      lastUpdated: new Date().toISOString(),
      rule: null,
      loading: false
    };

    return [almanacCard, ...stocks] as ExtendedStockData[];
  }, [stocks, almanacs, almanac]);

  const scrollOptions = useMemo(() => ({
    onOverscrollRight: () => setUserCenterOpen(true),
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

  const currentStock = displayStocks[currentIndex];
  // 严格布尔检查以消除警告
  const isMarketAlmanac = !!(currentStock && currentStock.isAlmanac);

  // 【核心修复：粘性标题】用来保持标题内容的“粘性”，防止在切换到黄历时由于数据过快切换而显示黄历的内部 ID
  const stickyStockInfo = useRef({ name: '', symbol: '' });
  if (currentStock && !currentStock.isAlmanac) {
    stickyStockInfo.current = { name: currentStock.name, symbol: currentStock.symbol };
  } else if (!stickyStockInfo.current.name && stocks.length > 0) {
    // 初始状态下若在黄历，预填入第一个真实股票的信息作为备选
    stickyStockInfo.current = { name: stocks[0].name, symbol: stocks[0].symbol };
  }

  // 2. 缓存所有 Modal 处理函数 (极致稳定性)
  const closeUserCenter = useCallback(() => setUserCenterOpen(false), []);
  const openUserCenter = useCallback(() => setUserCenterOpen(true), []);
  const closeBrief = useCallback(() => setBriefOpen(false), []);
  const openBrief = useCallback(() => setBriefOpen(true), []);
  const closeTactics = useCallback(() => setSelectedTactics(null), []);
  const closeProfile = useCallback(() => setProfileStock(null), []);
  
  const handleShowTactics = useCallback((symbol: string, prediction: AIPrediction) => {
    preloadCouncil(symbol, prediction.target_date);
    setSelectedTactics({ symbol, prediction });
  }, []);

  const handleVerticalScrollStable = useCallback((top: number, index: number) => {
    handleVerticalScroll(top, index);
  }, [handleVerticalScroll]);

  // 预解析战术数据，避免渲染时 JSON.parse
  const parsedTacticsData = useMemo(() => {
    if (!selectedTactics?.prediction?.ai_reasoning) return {};
    try {
      return JSON.parse(selectedTactics.prediction.ai_reasoning);
    } catch {
      return {};
    }
  }, [selectedTactics]);

  const selectedTacticStock = useMemo(
    () => stocks.find((s) => s.symbol === selectedTactics?.symbol),
    [stocks, selectedTactics?.symbol]
  );

  useEffect(() => {
    interface ExtendedNavigator { clearAppBadge?: () => Promise<void>; }
    const nav = navigator as ExtendedNavigator;
    if (typeof nav !== 'undefined' && nav.clearAppBadge) {
      nav.clearAppBadge().catch(console.error);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('brief') === 'true') {
      setBriefOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!currentStock || currentStock.isAlmanac) return;
    preloadCouncil(currentStock.symbol, currentStock.prediction?.target_date);
  }, [currentStock]);

  useEffect(() => {
    try {
      sessionStorage.removeItem(DASHBOARD_NAV_INTENT_KEY);
    } catch {
      // non-critical
    }
  }, []);

  return (
    <main className="fixed inset-0 bg-[#050508] text-white overflow-hidden select-none font-sans">
      <DashboardBackground 
        isAlmanac={isMarketAlmanac} 
        prediction={currentStock?.prediction} 
      />

      <header className="fixed top-0 left-0 right-0 z-[100] p-6 pointer-events-none">
        <div className="w-full flex justify-between items-start pointer-events-auto relative h-12">
           <div className="flex items-center gap-2 cursor-pointer group shrink-0" 
             onClick={() => isMarketAlmanac ? almanacRef.current?.share() : setProfileStock(currentStock)}
           >
              <div className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center transition-all group-active:scale-90 group-hover:bg-white/10 overflow-hidden relative">
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isMarketAlmanac ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}>
                      <Share2 className="w-5 h-5 text-indigo-400 group-hover:text-white transition-colors" />
                  </div>
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${!isMarketAlmanac ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}>
                      <div className="text-[10px] font-black italic text-indigo-500">{stickyStockInfo.current.symbol?.slice(-2) || ''}</div>
                  </div>
              </div>
           </div>

          <div className="absolute left-1/2 transform -translate-x-1/2 top-0 cursor-pointer group flex flex-col items-center h-12 justify-center w-48"
            onClick={() => !isMarketAlmanac && setProfileStock(currentStock)}
          >
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${isMarketAlmanac ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
               <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center">
                 ZISO AI · 投资黄历
               </h1>
               <span className="text-[10px] font-black italic opacity-0 mt-0.5 leading-none select-none">
                 ALMANAC_PLACEHOLDER
               </span>
            </div>
            
            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${!isMarketAlmanac ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
               <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center">
                 {stickyStockInfo.current.name}
               </h1>
               <span className="text-[10px] font-black italic text-slate-500 tracking-widest uppercase mt-0.5 leading-none">
                 {stickyStockInfo.current.symbol ? formatStockSymbol(stickyStockInfo.current.symbol) : ''}
               </span>
            </div>
          </div>

          <button onClick={() => isMarketAlmanac ? almanacRef.current?.copy() : openBrief()}
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

      <div ref={scrollRef} onScroll={handleScroll} className="h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide">
        {displayStocks.map((stock, idx) => {
          if (stock.isAlmanac) {
            return (
              <MarketAlmanacFeed 
                ref={almanacRef} key={stock.symbol} index={idx}
                data={stock.almanacData}
                onVerticalScroll={handleVerticalScrollStable} 
                scrollRequest={backToTopCounter}
              />
            );
          }
          return (
            <StockVerticalFeed 
              key={stock.symbol} index={idx} stock={stock} 
              onShowTactics={handleShowTactics} 
              onVerticalScroll={handleVerticalScrollStable}
              scrollRequest={backToTopCounter}
              onLoadMore={loadMoreHistory}
            />
          );
        })}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 pt-10 px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] flex flex-col items-center gap-6 z-[100] pointer-events-none">
        <AnimatePresence>
          {yScrollPosition > 100 && (
            <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              onClick={() => { scrollToToday(); if (typeof window !== 'undefined' && window.navigator?.vibrate) window.navigator.vibrate(10); }}
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
          <Link href="/dashboard/stock-pool" prefetch className="p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-95 transition-all pointer-events-auto inline-flex items-center justify-center cursor-pointer">
            <Grid className="w-5 h-5 text-indigo-400" />
          </Link>
          <button onClick={openUserCenter} className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/10 shrink-0 cursor-pointer">
            <User className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </footer>

      <TacticalBriefDrawer 
        isOpen={!!selectedTactics} 
        onClose={closeTactics} 
        tier={tier}
        data={parsedTacticsData}
        userPos={selectedTacticStock?.rule?.position || 'none'}
        model={selectedTactics?.prediction?.model}
        symbol={selectedTactics?.symbol || ''}
        targetDate={selectedTactics?.prediction?.target_date || ''}
        signal={selectedTactics?.prediction?.signal}
        confidence={selectedTactics?.prediction?.confidence}
        stockName={selectedTacticStock?.name}
        currentPrice={selectedTacticStock?.price?.close}
        shortMetrics={selectedTacticStock?.shortMetrics || null}
      />

      <AnimatePresence>
        {profileStock && <StockProfile stock={profileStock} onClose={closeProfile} />}
      </AnimatePresence>

      <UserCenterDrawer isOpen={userCenterOpen} onClose={closeUserCenter} />
      <BriefDrawer isOpen={briefOpen} onClose={closeBrief} limitToSymbol={currentStock?.symbol} onUpgrade={openUserCenter} />
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
