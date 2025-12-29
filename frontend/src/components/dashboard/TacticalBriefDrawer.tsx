'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X as CloseIcon, 
  Info, 
  TrendingUp, 
  Zap, 
  BarChart3, 
  RotateCcw, 
  Target,
  ChevronDown,
  Newspaper,
  Crosshair,
  Layers,
  Hash
} from 'lucide-react';
import { TacticalData } from '@/lib/types';

interface TacticalBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
}

// 辅助函数：获取步骤对应的图标和标签配置
const getStepConfig = (step: string) => {
  const s = step.toLowerCase();
  
  if (s.includes('trend')) return { icon: <TrendingUp size={12} />, label: 'TREND' };
  if (s.includes('momentum')) return { icon: <Zap size={12} />, label: 'MOMENTUM' };
  if (s.includes('volume')) return { icon: <BarChart3 size={12} />, label: 'VOLUME' };
  if (s.includes('history')) return { icon: <RotateCcw size={12} />, label: 'HISTORY' };
  if (s.includes('decision')) return { icon: <Target size={12} />, label: 'DECISION' };
  
  // 新增映射
  if (s.includes('news') || s.includes('fundamental')) return { icon: <Newspaper size={12} />, label: 'INTELLIGENCE' };
  if (s.includes('position') || s.includes('level') || s.includes('price')) return { icon: <Crosshair size={12} />, label: 'PRICE ACTION' };
  if (s.includes('context')) return { icon: <Layers size={12} />, label: 'CONTEXT' };

  // 兜底
  return { icon: <Hash size={12} />, label: s.toUpperCase().replace(/_/g, ' ') };
};

export function TacticalBriefDrawer({ 
  isOpen, onClose, data, userPos 
}: TacticalBriefDrawerProps) {
  // ... (中间代码省略) ...

                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    {(() => {
                                      const config = getStepConfig(step.step);
                                      return (
                                        <div className="flex items-center gap-2">
                                          <span className="text-slate-500">{config.icon}</span>
                                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                            {config.label}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full italic tracking-tight">
                                      {step.conclusion}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-200/60 font-medium leading-relaxed">
                                    {step.data}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )}

                <section className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> 核心冲突处理原则</h3>
                  <p className="text-sm text-indigo-300/70 leading-relaxed italic">{data.conflict_resolution || "遵循趋势优先原则。"}</p>
                </section>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

