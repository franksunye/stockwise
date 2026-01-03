'use client';

import { useState, useEffect } from 'react';
import { StockData, AIPrediction } from '@/lib/types';
import { StockDashboardCard } from './StockDashboardCard';
import { HistoricalCard } from './HistoricalCard';
import { VerticalIndicator } from './VerticalIndicator';

interface StockVerticalFeedProps {
  stock: StockData;
  onShowTactics: (prediction: AIPrediction) => void;
  onVerticalScroll: (top: number) => void;
  scrollRequest?: number;
}

export function StockVerticalFeed({ 
  stock, 
  onShowTactics, 
  onVerticalScroll, 
  scrollRequest 
}: StockVerticalFeedProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  
  // 监听回顶请求
  useEffect(() => {
    if (container && scrollRequest !== undefined) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [container, scrollRequest]);

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
      </div>
    </div>
  );
}
