"use client";

import { useEffect } from "react";

/**
 * 徽章管理器组件
 * 用于在用户打开应用时清除 PWA 图标徽章
 */
export function BadgeManager() {
  useEffect(() => {
    // 当用户打开/进入应用时，清除徽章
    const clearBadge = async () => {
      if ("clearAppBadge" in navigator) {
        try {
          await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
        } catch (e) {
          // 忽略错误 - 可能是权限问题或不支持
          console.debug("Failed to clear badge:", e);
        }
      } else if ("setAppBadge" in navigator) {
        try {
          await (navigator as Navigator & { setAppBadge: (count: number) => Promise<void> }).setAppBadge(0);
        } catch (e) {
          console.debug("Failed to set badge to 0:", e);
        }
      }

      // 同时清除 Service Worker IndexedDB 中的计数
      // 通过 postMessage 通知 SW
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "CLEAR_BADGE_COUNT"
        });
      }
    };

    // 立即清除
    clearBadge();

    // 页面可见时也清除（用户从后台切换回来时）
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        clearBadge();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
