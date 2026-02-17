"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistrar — 在应用启动时静默注册 Service Worker
 *
 * 之前 SW 仅在用户打开"通知设置"时才按需注册。
 * 但 Android Chrome 要求 SW 必须提前注册并包含 fetch handler，
 * 才会触发 `beforeinstallprompt` 事件 → 才能提供"一键安装"体验。
 *
 * 此组件在 Dashboard Layout 中挂载，确保 SW 尽早注册。
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // Register on idle to not block first paint
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] Registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    };

    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(register);
    } else {
      setTimeout(register, 1000);
    }
  }, []);

  return null;
}
