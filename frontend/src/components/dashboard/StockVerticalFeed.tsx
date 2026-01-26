import { useState, useEffect, useRef } from 'react';
import { StockData, AIPrediction } from '@/lib/types';
import { StockDashboardCard } from './StockDashboardCard';
import { HistoricalCard } from './HistoricalCard';
import { VerticalIndicator } from './VerticalIndicator';

interface StockVerticalFeedProps {
  stock: StockData;
  onShowTactics: (prediction: AIPrediction) => void;
  onVerticalScroll: (top: number) => void;
  onLoadMore?: (symbol: string, offset: number) => void;
  scrollRequest?: number;
}

export function StockVerticalFeed({ 
  stock, 
  onShowTactics, 
  onVerticalScroll, 
  onLoadMore,
  scrollRequest 
}: StockVerticalFeedProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  
  // 监听回顶请求
  useEffect(() => {
    if (container && scrollRequest !== undefined) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [container, scrollRequest]);

  // 懒加载触发
  useEffect(() => {
    if (!onLoadMore || !container) return;
    
    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && !stock.loadingMore && stock.hasMoreHistory !== false) {
        onLoadMore(stock.symbol, stock.history.length);
      }
    }, {
      root: container,
      rootMargin: '200px', // 提前 200px 加载
      threshold: 0.1
    });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [container, stock.loadingMore, stock.hasMoreHistory, stock.history.length, onLoadMore, stock.symbol]);

  return (
    <div className="min-w-full h-full relative snap-center overflow-hidden">
      <VerticalIndicator container={container} onScroll={onVerticalScroll} />
      <div 
        ref={setContainer}
        className="w-full h-full absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
      >
        {/* Y轴 垂直内容 (TikTok Mode) */}
        <StockDashboardCard data={stock} onShowTactics={onShowTactics} />
        {stock.history.slice(1).map((h, i) => <HistoricalCard key={i} data={h} onClick={onShowTactics} />)}
        
        {/* 底部加载触发区 */}
        <div ref={loaderRef} className="w-full py-8 flex items-center justify-center min-h-[60px] snap-end">
           {stock.loadingMore && (
             <div className="w-5 h-5 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin" />
           )}
           {stock.hasMoreHistory === false && stock.history.length > 7 && (
             <span className="text-[9px] font-black text-white/10 tracking-[0.2em] uppercase">NO MORE DATA</span>
           )}
        </div>
      </div>
    </div>
  );
}
