'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  const name = error.name || '';
  return (
    name === 'ChunkLoadError' ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Importing a module script failed')
  );
}

const CHUNK_RELOAD_KEY = 'ziso_chunk_reload_ts';
const NAV_RECOVERY_KEY = 'ziso_nav_recovery_ts';
const RECOVERY_COOLDOWN_MS = 10_000;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showErrorUI, setShowErrorUI] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);

    if (isChunkLoadError(error)) {
      const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
      if (Date.now() - lastReload > RECOVERY_COOLDOWN_MS) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        navigator.serviceWorker?.controller?.postMessage('CLEAR_CACHES');
        window.location.reload();
        return;
      }
      setShowErrorUI(true);
      return;
    }

    // Non-chunk errors (RSC navigation timeout, network failure, etc.):
    // Auto-recover via hard navigation → SW's navigationCacheFirst serves
    // the cached HTML shell instantly, avoiding the error page entirely.
    // CRITICAL: Do NOT send CLEAR_CACHES here — the navigation HTML cache
    // is our recovery lifeline, especially when completely offline.
    const lastRecovery = Number(sessionStorage.getItem(NAV_RECOVERY_KEY) || '0');
    if (Date.now() - lastRecovery > RECOVERY_COOLDOWN_MS) {
      sessionStorage.setItem(NAV_RECOVERY_KEY, String(Date.now()));
      window.location.href = window.location.pathname + window.location.search;
      return;
    }

    setShowErrorUI(true);
  }, [error]);

  const handleRetry = () => {
    setRetrying(true);
    navigator.serviceWorker?.controller?.postMessage('CLEAR_CACHES');
    if (isChunkLoadError(error)) {
      window.location.reload();
    } else {
      reset();
      setTimeout(() => setRetrying(false), 1000);
    }
  };

  if (!showErrorUI) return null;

  return (
    <div className="fixed inset-0 bg-[#050508] flex items-center justify-center px-8">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-amber-500" size={28} />
        </div>
        <h2 className="text-lg font-black italic tracking-tighter text-white mb-2">
          页面加载异常
        </h2>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          可能是网络波动或版本更新导致，点击下方按钮即可恢复。
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-500 text-white text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_10px_20px_rgba(99,102,241,0.3)] disabled:opacity-50"
        >
          <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
          {retrying ? '恢复中...' : '重新加载'}
        </button>
        {error.digest && (
          <p className="mt-6 text-[10px] text-slate-600 mono">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
