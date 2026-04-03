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
 *
 * ── 本地开发（next dev）特别说明 — 不影响线上 ──
 * 仅当同时满足：hostname 为 localhost 或 127.0.0.1，且 NODE_ENV === 'development' 时，
 * 会先注销本来源下已有 SW 并清空 Cache Storage，然后直接 return，不再注册 /sw.js。
 * 原因：`public/sw.js` 对 /_next/static 使用 CacheFirst，在不停改代码的 next dev 下极易命中旧 chunk，
 * 表现为偶发旧逻辑（例如已废弃的 localStorage 键）复活；卸载 SW 可避免误判为业务代码回归。
 * 线上（如 Vercel：NODE_ENV=production、域名为正式域名）不满足上述条件，仍走下方完整注册与更新逻辑，行为与改动前一致。
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
        const host = window.location.hostname;
        const isLocalDevHost = host === "localhost" || host === "127.0.0.1";
        // 必须「本机环回 + development」同时成立，才卸载 SW；线上 production 永远不会进此分支。
        if (isLocalDevHost && process.env.NODE_ENV === "development") {
          // 若用户曾在 localhost 上注册过 SW，浏览器会持续用 Cache Storage 里的旧 /_next/static，
          // 与当前磁盘上的源码不一致 → 强刷也可能跑到旧包（例：已废弃的 stockwise_user_profile_v1）。
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          console.info("[SW] Local dev: unregistered service worker(s) and cleared Cache Storage.");
          return;
        }

        // 线上与其它环境：照常注册 PWA Service Worker（见文件头注释）。
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
