'use client';

import multiavatar from '@multiavatar/multiavatar';
import { useMemo } from 'react';

interface MultiavatarProps {
  name: string;
  className?: string; // 用于外部容器的样式，比如大小
}

export default function Multiavatar({ name, className }: MultiavatarProps) {
  // 使用 useMemo 缓存生成的 SVG，避免不必要的重新计算
  const svgCode = useMemo(() => multiavatar(name), [name]);

  return (
    <div 
      className={className}
      // multiavatar 返回的是 SVG 字符串，必须用 dangerouslySetInnerHTML 注入
      dangerouslySetInnerHTML={{ __html: svgCode }}
    />
  );
}
