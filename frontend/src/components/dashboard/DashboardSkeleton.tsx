'use client';

/**
 * DashboardSkeleton — 工业级 iOS 高性能骨架屏
 * 严格遵循项目 CSS 军规：
 * 1. 无 backdrop-filter / blur (防止 iOS Safari 崩溃)
 * 2. 比例与 StockDashboardCard 像素级对应
 * 3. 采用 transform 硬件加速动画（仅主卡片 1 个 shimmer）
 * 4. 零外部依赖（不引入 lucide-react），确保首屏路径最轻量
 */
export function DashboardSkeleton() {
  return (
    <div 
      className="h-[100dvh] w-full flex flex-col items-center justify-center px-4 overflow-hidden relative"
      style={{
        backgroundColor: '#050508',
        backgroundImage: 'radial-gradient(circle at 50% -20%, #1e1b4b 0%, transparent 50%), radial-gradient(circle at 0% 100%, #111827 0%, transparent 40%)'
      }}
    >
      <div className="w-full max-w-md space-y-6 mx-auto relative z-10">
        
        {/* 1. Header Area (Status & Signal) */}
        <section className="text-center space-y-4 py-2 flex flex-col items-center">
          {/* Status Capsule */}
          <div className="w-32 h-6 rounded-full bg-white/[0.03] border border-white/[0.08]" />
          {/* Main Action Text Placeholder */}
          <div className="w-56 h-12 rounded-2xl bg-white/[0.05]" />
          {/* Subtext */}
          <div className="w-24 h-2 rounded-full bg-white/[0.03]" />
        </section>

        {/* 2. Main AI Insight Card (模仿 .glass-card 降级后的样式) */}
        <section className="w-full aspect-[16/10] bg-[#0f0f17] border border-white/[0.12] rounded-[32px] p-6 space-y-6 relative overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/30" />
            <div className="w-24 h-3 rounded-full bg-white/[0.05]" />
          </div>
          
          <div className="space-y-3">
            <div className="w-full h-3 rounded-full bg-white/[0.05]" />
            <div className="w-11/12 h-3 rounded-full bg-white/[0.05]" />
            <div className="w-4/6 h-3 rounded-full bg-white/[0.02]" />
          </div>

          {/* 唯一的 shimmer 动画层 — 仅主卡片使用，减少 GPU 合成层数量 */}
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full" />
          
          <div className="mt-8 w-full h-12 rounded-2xl bg-indigo-500/[0.08] border border-indigo-500/20" />
        </section>

        {/* 3. Bottom Grid (纯静态，无动画) */}
        <section className="grid grid-cols-2 gap-4">
          <div className="aspect-[4/3] bg-[#0f0f17] border border-white/[0.1] rounded-[28px]" />
          <div className="aspect-[4/3] bg-[#0f0f17] border border-white/[0.1] rounded-[28px]" />
        </section>

      </div>
    </div>
  );
}
