'use client';

import { useEffect, useRef, useState, type TouchEventHandler } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type SlideItem = {
  src: string;
  alt: string;
  objectPosition: string;
};

type FocusedImageSliderProps = {
  slides: SlideItem[];
  className?: string;
};

export function FocusedImageSlider({ slides, className = '' }: FocusedImageSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);

  if (!slides.length) return null;

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length);
  };

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (event) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchDeltaXRef.current = 0;
    setIsPaused(true);
  };

  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (event) => {
    if (touchStartXRef.current === null) return;
    const currentX = event.touches[0]?.clientX ?? touchStartXRef.current;
    touchDeltaXRef.current = currentX - touchStartXRef.current;
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = () => {
    const SWIPE_THRESHOLD = 40;
    if (touchDeltaXRef.current <= -SWIPE_THRESHOLD) {
      goNext();
    } else if (touchDeltaXRef.current >= SWIPE_THRESHOLD) {
      goPrev();
    }
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
    setIsPaused(false);
  };

  return (
    <div
      className={`glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {slides.map((slide, index) => (
        <div
          key={`${slide.src}-${index}`}
          className={`absolute inset-0 transition-opacity duration-500 ${
            index === activeIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover opacity-90"
            style={{ objectPosition: slide.objectPosition }}
          />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-4 flex items-center justify-between px-4 z-20">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous image"
          className="w-9 h-9 rounded-full bg-black/45 border border-white/10 text-slate-200 hover:bg-black/65 transition-colors flex items-center justify-center"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={`dot-${slide.src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Go to image ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-indigo-400' : 'w-1.5 bg-white/35 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next image"
          className="w-9 h-9 rounded-full bg-black/45 border border-white/10 text-slate-200 hover:bg-black/65 transition-colors flex items-center justify-center"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
