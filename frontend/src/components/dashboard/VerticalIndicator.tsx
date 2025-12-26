'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VerticalIndicatorProps {
  container: HTMLDivElement | null;
  onScroll?: (top: number) => void;
}

export function VerticalIndicator({ container, onScroll }: VerticalIndicatorProps) {
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
    <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
      <AnimatePresence>
        {isVisible && (
          <motion.div 
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            transition={{ duration: 0.2 }}
            className="absolute right-1 top-1/3 bottom-1/3 w-0.5 bg-white/10 rounded-full"
          >
            <motion.div 
              className="absolute left-0 right-0 bg-white/45 rounded-full"
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
