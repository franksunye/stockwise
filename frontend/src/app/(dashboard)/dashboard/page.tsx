'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid as Grid, ChevronDown, RefreshCw, User } from 'lucide-react';
import { StockData } from '@/lib/types';
import { 
  TacticalBriefDrawer, 
  StockProfile,
  StockVerticalFeed,
  COLORS 
} from '@/components/dashboard';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useTikTokScroll } from '@/hooks/useTikTokScroll';

import { getCurrentUser } from '@/lib/user';

const UserCenterDrawer = dynamic(() => import('@/components/UserCenterDrawer').then(mod => mod.UserCenterDrawer), {
  ssr: false,
  loading: () => null
});

function DashboardContent() {
  const router = useRouter();
  const [userCenterOpen, setUserCenterOpen] = useState(false);

  const { stocks, loadingPool, refresh, isRefreshing } = useDashboardData();
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

  const [showTactics, setShowTactics] = useState<string | null>(null);
  const [profileStock, setProfileStock] = useState<StockData | null>(null);
  const [tier, setTier] = useState<'free' | 'pro'>('free');

  useEffect(() => {
    const fetchTier = async () => {
      const user = await getCurrentUser();
      try {
        const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, watchlist: [] })
        });
        const data = await res.json();
        setTier(data.tier || 'free');
      } catch (e) { console.error(e); }
    };
    fetchTier();
  }, []);

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
            className="absolute left-1/2 transform -translate-x-1/2 top-6 cursor-pointer group"
            onClick={() => setProfileStock(currentStock)}
          >
            <h1 className="text-xl font-black italic tracking-tight text-white group-hover:text-indigo-400 transition-colors text-center">
              {currentStock?.name}
            </h1>
          </div>

          {/* 右侧：极简刷新按钮 (隐藏倒计时) */}
          <button 
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-[16px] bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all disabled:opacity-50 hover:bg-white/10"
            title={isRefreshing ? '刷新中...' : '点击刷新'}
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
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
            onShowTactics={() => setShowTactics(stock.symbol)} 
            onVerticalScroll={handleVerticalScroll}
            scrollRequest={currentIndex === idx ? backToTopCounter : undefined}
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
        isOpen={!!showTactics} 
        onClose={() => setShowTactics(null)} 
        tier={tier}
        data={JSON.parse(stocks.find(s => s.symbol === showTactics)?.prediction?.ai_reasoning || '{}')}
        userPos={stocks.find(s => s.symbol === showTactics)?.rule?.position || 'none'}
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
