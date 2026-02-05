'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGrid as Grid, ChevronDown, User, FileText } from 'lucide-react';
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
import { useStocks } from '@/context/StockContext';
import { useTikTokScroll } from '@/hooks/useTikTokScroll';
import { useUserProfile } from '@/hooks/useUserProfile';

const UserCenterDrawer = dynamic(() => import('@/components/UserCenterDrawer'), {
  ssr: false,
  loading: () => null
});

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userCenterOpen, setUserCenterOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const { stocks, loadingPool, loadMoreHistory } = useStocks();
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
    onOverscrollLeft: () => router.push('/dashboard/stock-pool')
  });

  const [selectedTactics, setSelectedTactics] = useState<{ symbol: string; prediction: AIPrediction } | null>(null);
  const [profileStock, setProfileStock] = useState<StockData | null>(null);
  const { tier } = useUserProfile();

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('brief') === 'true') {
      setBriefOpen(true);
    }
  }, [searchParams]);

  if (loadingPool && stocks.length === 0) {
    return (
      <div className="min-h-screen bg-[#050508] p-6 space-y-10">
        <div className="flex justify-between items-center">
          <div className="w-10 h-10 rounded-2xl bg-white/5 animate-pulse" />
          <div className="w-32 h-6 bg-white/5 rounded-lg animate-pulse" />
          <div className="w-10 h-10 rounded-2xl bg-white/5 animate-pulse" />
        </div>
        <div className="aspect-[3/4] rounded-[32px] bg-white/[0.02] border border-white/5 animate-pulse" />
      </div>
    );
  }

  const currentStock = stocks[currentIndex];
  const signalColor = currentStock?.prediction?.signal === 'Long' ? COLORS.up : 
                     currentStock?.prediction?.signal === 'Short' ? COLORS.down : COLORS.hold;

  return (
    <main className="fixed inset-0 bg-[#050508] text-white overflow-hidden select-none font-sans">
      {/* Dynamic Background Glow */}
      <div 
        className="fixed inset-0 pointer-events-none transition-colors duration-1000 ease-in-out opacity-[0.08]"
        style={{ 
          backgroundColor: signalColor,
          filter: 'blur(120px)', 
          scale: 1.5
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[100] p-6 pointer-events-none">
        <div className="w-full flex justify-between items-start pointer-events-auto">
           <div 
             className="flex items-center gap-2 cursor-pointer group shrink-0" 
             onClick={() => setProfileStock(currentStock)}
           >
              <div className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center transition-all group-active:scale-95 group-hover:bg-white/10">
                 <div className="text-[10px] font-black italic text-indigo-500">{currentStock?.symbol.slice(-2)}</div>
              </div>
           </div>

          <div 
            className="absolute left-1/2 -translate-x-1/2 top-6 cursor-pointer group flex flex-col items-center"
            onClick={() => setProfileStock(currentStock)}
          >
            <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center">
              {currentStock?.name}
            </h1>
            <span className="text-[10px] font-black italic text-slate-500 tracking-widest uppercase mt-0.5">
              {currentStock ? formatStockSymbol(currentStock.symbol) : ''}
            </span>
          </div>

          <button 
            onClick={() => setBriefOpen(true)}
            className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-white/10 group"
          >
            <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
          </button>
        </div>
      </header>

      {/* Horizontal Scroll Feed */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`h-full w-full flex overflow-x-scroll snap-x snap-mandatory scrollbar-hide transition-opacity duration-300 ${(profileStock || userCenterOpen) ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}
      >
        {stocks.map((stock, idx) => (
          <StockVerticalFeed 
            key={stock.symbol} 
            stock={stock} 
            onShowTactics={(prediction) => setSelectedTactics({ symbol: stock.symbol, prediction })} 
            onVerticalScroll={(top) => handleVerticalScroll(top, idx)}
            scrollRequest={currentIndex === idx ? backToTopCounter : undefined}
            onLoadMore={loadMoreHistory}
          />
        ))}
      </div>

      {/* Footer Controls */}
      <footer className="fixed bottom-0 left-0 right-0 p-10 px-8 flex flex-col items-center gap-6 z-[100] pointer-events-none">
        {yScrollPosition > 100 && (
          <button 
            onClick={() => scrollToToday()}
            className="flex items-center gap-2 bg-indigo-500 text-white px-5 py-2.5 rounded-full shadow-lg active:scale-90 transition-all pointer-events-auto animate-in fade-in slide-in-from-bottom-2"
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
            <span className="text-[10px] font-black uppercase tracking-widest">回到今天</span>
          </button>
        )}

        <div className="flex gap-2">
          {stocks.map((_, idx) => (
            <div key={idx} className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
          ))}
        </div>
        <div className="w-full flex justify-between items-center pointer-events-auto">
          <Link href="/dashboard/stock-pool" prefetch className="p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-95 transition-all">
            <Grid className="w-5 h-5 text-indigo-400" />
          </Link>
          
          <button onClick={() => setUserCenterOpen(true)} className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-all active:scale-90 hover:bg-white/10">
            <User className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </footer>

      {/* Overlays */}
      <TacticalBriefDrawer 
        isOpen={!!selectedTactics} 
        onClose={() => setSelectedTactics(null)} 
        tier={tier}
        data={(() => {
          try { return JSON.parse(selectedTactics?.prediction?.ai_reasoning || '{}'); } catch { return {}; }
        })()}
        userPos={stocks.find(s => s.symbol === selectedTactics?.symbol)?.rule?.position || 'none'}
        model={selectedTactics?.prediction?.model}
        symbol={selectedTactics?.symbol || ''}
        targetDate={selectedTactics?.prediction?.target_date || ''}
      />

      <StockProfile stock={profileStock} isOpen={!!profileStock} onClose={() => setProfileStock(null)} />
      <UserCenterDrawer isOpen={userCenterOpen} onClose={() => setUserCenterOpen(false)} />
      <BriefDrawer isOpen={briefOpen} onClose={() => setBriefOpen(false)} limitToSymbol={currentStock?.symbol} onUpgrade={() => setUserCenterOpen(true)} />
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
