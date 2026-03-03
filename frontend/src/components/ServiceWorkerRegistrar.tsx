"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistrar — 工业级 Service Worker 管理
 *
 * 职责：
 * 1. 注册 Service Worker（PWA 安装的前提条件）
 * 2. 检测 SW 更新并自动激活（确保用户始终运行最新版本）
 * 3. iOS Safari 兼容（不支持 requestIdleCallback）
 *
 * 注册时机策略：
 * - Desktop/Chrome: 使用 requestIdleCallback 避免阻塞首屏
 * - iOS Safari: load 事件后 100ms（iOS 不支持 requestIdleCallback）
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("[SW] Registered:", registration.scope);

        // ── 检测 SW 更新 ──
        // 当服务器上的 sw.js 文件内容变化时，浏览器会自动检测到并
        // 触发 updatefound 事件。新 SW 进入 installing → waiting 状态。
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              // 新 SW 已激活，意味着缓存策略已更新。
              // 但我们不强制刷新页面（避免打断用户操作），
              // 用户下次打开 App 时自然会使用新版本。
              console.log("[SW] New version activated. Will use on next visit.");
            }
          });
        });

        // ── 定期检查更新（每小时）──
        // Vercel 部署时 sw.js 会自动更新，但 iOS PWA 可能长时间
        // 不关闭 App，导致错过更新检查。主动轮询确保不落后太多版本。
        setInterval(() => {
          registration.update().catch(() => {
            // Silent failure — update check is best-effort
          });
        }, 60 * 60 * 1000);
      } catch (err) {
        console.warn("[SW] Registration failed:", err);
      }
    };

    // iOS Safari 不支持 requestIdleCallback
    // 使用 load 事件后的短延迟，确保不阻塞首次渲染
    const ric = (globalThis as Record<string, unknown>).requestIdleCallback as
      | ((cb: () => void) => void)
      | undefined;

    if (ric) {
      ric(register);
    } else if (document.readyState === "complete") {
      // iOS 路径：页面已完成加载，100ms 后注册
      setTimeout(register, 100);
    } else {
      // iOS 路径：等待页面完全加载后 100ms 注册
      globalThis.addEventListener("load", () => setTimeout(register, 100), { once: true });
    }
  }, []);

  return null;
}
