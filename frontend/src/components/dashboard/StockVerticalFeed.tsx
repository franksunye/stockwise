import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { StockData, AIPrediction } from '@/lib/types';
import { StockDashboardCard } from './StockDashboardCard';
import { HistoricalCard } from './HistoricalCard';
import { VerticalIndicator } from './VerticalIndicator';
import { VerticalLayerState, VerticalPositionRequest } from '@/hooks/useTikTokScroll';

interface StockVerticalFeedProps {
  stock: StockData;
  onShowTactics: (symbol: string, prediction: AIPrediction) => void;
  onVerticalScroll: (top: number, symbol: string) => void;
  onVerticalLayerChange?: (symbol: string, layer: VerticalLayerState) => void;
  onLoadMore?: (symbol: string, offset: number) => void;
  scrollRequest?: number;
  positionRequest?: VerticalPositionRequest | null;
}

export const StockVerticalFeed = memo(function StockVerticalFeed({ 
  stock, 
  onShowTactics, 
  onVerticalScroll, 
  onVerticalLayerChange,
  onLoadMore,
  scrollRequest,
  positionRequest
}: StockVerticalFeedProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const getCardElements = useCallback(() => {
    if (!container) return [];
    return Array.from(container.children).slice(0, stock.history.length) as HTMLElement[];
  }, [container, stock.history.length]);

  const resolveClosestHistoryIndex = useCallback((targetDate: string) => {
    const historyCards = stock.history.slice(1);
    if (historyCards.length === 0) return 0;

    const exactIndex = historyCards.findIndex(item => item.target_date === targetDate);
    if (exactIndex !== -1) return exactIndex + 1;

    const targetTime = new Date(`${targetDate}T00:00:00`).getTime();
    let earlierMatchIndex: number | null = null;
    let earlierMatchTime = Number.NEGATIVE_INFINITY;
    let nearestIndex = 1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    historyCards.forEach((item, itemIndex) => {
      const candidateTime = new Date(`${item.target_date}T00:00:00`).getTime();
      const distance = Math.abs(candidateTime - targetTime);

      if (candidateTime <= targetTime && candidateTime > earlierMatchTime) {
        earlierMatchTime = candidateTime;
        earlierMatchIndex = itemIndex + 1;
      }

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = itemIndex + 1;
      }
    });

    return earlierMatchIndex ?? nearestIndex;
  }, [stock.history]);
  
  // 监听回顶请求
  const prevScrollRequestRef = useRef(scrollRequest || 0);
  useEffect(() => {
    if (container && scrollRequest !== undefined && scrollRequest > prevScrollRequestRef.current) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      prevScrollRequestRef.current = scrollRequest;
    }
  }, [container, scrollRequest]);

  const prevPositionRequestRef = useRef<number | null>(null);
  useEffect(() => {
    if (!container || !positionRequest) return;
    if (prevPositionRequestRef.current === positionRequest.nonce) return;

    prevPositionRequestRef.current = positionRequest.nonce;

    if (positionRequest.type === 'today' || !positionRequest.date) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      onVerticalLayerChange?.(stock.symbol, { type: 'today', date: null });
      return;
    }

    const targetIndex = resolveClosestHistoryIndex(positionRequest.date);
    const cards = getCardElements();
    const targetCard = cards[targetIndex];

    if (!targetCard) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      onVerticalLayerChange?.(stock.symbol, { type: 'today', date: null });
      return;
    }

    container.scrollTo({ top: targetCard.offsetTop, behavior: 'smooth' });
    onVerticalLayerChange?.(stock.symbol, {
      type: targetIndex === 0 ? 'today' : 'history',
      date: targetIndex === 0 ? null : stock.history[targetIndex]?.target_date || null
    });
  }, [container, getCardElements, onVerticalLayerChange, positionRequest, resolveClosestHistoryIndex, stock.history, stock.symbol]);

  // 懒加载触发
  useEffect(() => {
    if (!onLoadMore || !container) return;
    
    const observer = new IntersectionObserver((entries) => {
      const target = entries[0];
      if (target.isIntersecting && !stock.loadingMore && stock.hasMoreHistory === true) {
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

  // Stable wrappers for children
  const handleShowTactics = (prediction: AIPrediction) => onShowTactics(stock.symbol, prediction);
  const handleScroll = (top: number) => {
    onVerticalScroll(top, stock.symbol);

    const cards = getCardElements();
    if (cards.length === 0) return;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cards.forEach((card, cardIndex) => {
      const distance = Math.abs(card.offsetTop - top);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = cardIndex;
      }
    });

    onVerticalLayerChange?.(stock.symbol, {
      type: nearestIndex === 0 ? 'today' : 'history',
      date: nearestIndex === 0 ? null : stock.history[nearestIndex]?.target_date || null
    });
  };

  return (
    <div className="min-w-full h-full shrink-0 relative snap-start snap-always overflow-hidden">
      <VerticalIndicator container={container} onScroll={handleScroll} />
      {/* Layout Contract:
          This is a snap-y viewport. Each child card must occupy one full viewport page
          (100dvh + shrink-0 in child components), otherwise cards will collapse and stack. */}
      <div 
        ref={setContainer}
        className="w-full h-full absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide flex flex-col items-center"
      >
        {/* Y轴 垂直内容 (TikTok Mode) */}
        <StockDashboardCard data={stock} onShowTactics={handleShowTactics} />
        {stock.history.slice(1).map((h, i) => <HistoricalCard key={i} data={h} onClick={handleShowTactics} />)}
        
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
});
