'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share, ExternalLink, Smartphone, Monitor } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

/**
 * InstallGuide — 全局 PWA 安装引导组件
 *
 * 根据用户运行环境自动显示对应的安装指引：
 * 1. 微信/企微  → 提示"在浏览器中打开"
 * 2. iOS Safari → 提示"分享 → 添加到主屏幕"
 * 3. Android Chrome/Edge → 一键触发原生安装弹窗
 * 4. Android 国产浏览器 → 图文手动引导
 */
export function InstallGuide() {
  const { guide, cnBrowser, visible, promptInstall, dismiss, canPrompt } = useInstallPrompt();

  // Don't show install guide until onboarding is complete.
  // Otherwise the guide flashes briefly before being covered by the full-screen OnboardingOverlay.
  const hasOnboarded = typeof window !== 'undefined' && localStorage.getItem('STOCKWISE_HAS_ONBOARDED');

  if (!visible || !hasOnboarded) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="fixed bottom-20 left-0 right-0 z-[150] flex justify-center px-4 pointer-events-none"
        >
          <div className="w-full max-w-md pointer-events-auto">
            {guide === 'wechat' && <WeChatGuide onDismiss={dismiss} />}
            {guide === 'ios-safari' && <IOSSafariGuide onDismiss={dismiss} />}
            {guide === 'android-native' && (
              <AndroidNativeGuide
                onInstall={promptInstall}
                onDismiss={dismiss}
                canPrompt={canPrompt}
              />
            )}
            {guide === 'android-manual' && (
              <AndroidManualGuide cnBrowser={cnBrowser} onDismiss={dismiss} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GuideCard({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="relative bg-[#0f0f18]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-500 hover:text-white"
        aria-label="关闭引导"
      >
        <X size={14} />
      </button>
      {children}
    </div>
  );
}

// 1. WeChat Guide — Must exit to external browser
function WeChatGuide({ onDismiss }: { onDismiss: () => void }) {
  return (
    <GuideCard onDismiss={onDismiss}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <ExternalLink className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 text-left">
          <h4 className="text-sm font-black text-white mb-1">在浏览器中打开</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            点击右上角 <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-white font-bold text-[10px]">⋯</span> 选择
            <span className="text-white font-bold">&ldquo;在浏览器打开&rdquo;</span>，即可安装为独立 App。
          </p>
        </div>
      </div>
      {/* Visual arrow pointing to top-right corner */}
      <div className="mt-3 flex justify-end pr-2">
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider animate-bounce">
          <span>↗</span>
          <span>点击右上角</span>
        </div>
      </div>
    </GuideCard>
  );
}

// 2. iOS Safari Guide — Share → Add to Home Screen
function IOSSafariGuide({ onDismiss }: { onDismiss: () => void }) {
  return (
    <GuideCard onDismiss={onDismiss}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 text-left">
          <h4 className="text-sm font-black text-white mb-1">添加到主屏幕</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            获得全屏 App 体验，实时接收行情通知。
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Step number={1}>
          点击底部 <Share className="inline w-3.5 h-3.5 text-blue-400 -mt-0.5" /> 分享按钮
        </Step>
        <div className="text-slate-600 text-xs">→</div>
        <Step number={2}>
          选择 <span className="text-white font-bold">&ldquo;添加到主屏幕&rdquo;</span>
        </Step>
      </div>
    </GuideCard>
  );
}

// 3. Android Native Guide — One-click install via beforeinstallprompt
function AndroidNativeGuide({
  onInstall,
  onDismiss,
  canPrompt,
}: {
  onInstall: () => Promise<void>;
  onDismiss: () => void;
  canPrompt: boolean;
}) {
  return (
    <GuideCard onDismiss={onDismiss}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1 text-left">
          <h4 className="text-sm font-black text-white mb-1">安装 ZISO AI</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            一键安装到桌面，全屏使用、实时通知、秒开体验。
          </p>
        </div>
      </div>
      <button
        onClick={onInstall}
        disabled={!canPrompt}
        className="mt-4 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all text-white text-sm font-black tracking-wide uppercase flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Download size={16} />
        安装到桌面
      </button>
    </GuideCard>
  );
}

// 4. Android Manual Guide — Chinese OEM browsers
function AndroidManualGuide({
  cnBrowser,
  onDismiss,
}: {
  cnBrowser: string | null;
  onDismiss: () => void;
}) {
  const brandNames: Record<string, string> = {
    huawei: '华为浏览器',
    xiaomi: '小米浏览器',
    uc: 'UC 浏览器',
    quark: '夸克浏览器',
    qq: 'QQ 浏览器',
    sogou: '搜狗浏览器',
    baidu: '百度浏览器',
  };

  const browserName = cnBrowser ? brandNames[cnBrowser] || '当前浏览器' : '当前浏览器';

  // Brand-specific instructions
  const getInstructions = () => {
    switch (cnBrowser) {
      case 'huawei':
        return (
          <>
            <Step number={1}>点击底部菜单 <span className="text-white font-bold">⋯</span></Step>
            <Step number={2}>选择 <span className="text-white font-bold">&ldquo;添加到桌面&rdquo;</span></Step>
            <Step number={3}>若被拦截，前往 <span className="text-white font-bold">设置 → 应用 → 权限</span>，允许创建桌面快捷方式</Step>
          </>
        );
      case 'xiaomi':
        return (
          <>
            <Step number={1}>点击底部菜单 <span className="text-white font-bold">⋯</span></Step>
            <Step number={2}>选择 <span className="text-white font-bold">&ldquo;添加到桌面&rdquo;</span></Step>
            <Step number={3}>若提示权限，选择 <span className="text-white font-bold">&ldquo;允许&rdquo;</span></Step>
          </>
        );
      default:
        return (
          <>
            <Step number={1}>点击底部或右上角的 <span className="text-white font-bold">菜单</span></Step>
            <Step number={2}>找到 <span className="text-white font-bold">&ldquo;添加到桌面&rdquo;</span> 或 <span className="text-white font-bold">&ldquo;添加快捷方式&rdquo;</span></Step>
          </>
        );
    }
  };

  return (
    <GuideCard onDismiss={onDismiss}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Monitor className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 text-left">
          <h4 className="text-sm font-black text-white mb-1">添加到桌面</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            检测到 <span className="text-amber-300 font-bold">{browserName}</span>，请手动添加：
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2 text-left">
        {getInstructions()}
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-[10px] text-slate-600 text-left leading-relaxed">
          💡 推荐使用 Chrome 浏览器打开 <span className="text-slate-400 font-bold">ziso.cc</span>，可一键安装为独立 App。
        </p>
      </div>
    </GuideCard>
  );
}

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black text-slate-300">
        {number}
      </span>
      <span className="text-xs text-slate-400 leading-relaxed">{children}</span>
    </div>
  );
}

export default InstallGuide;
