'use client';

/**
 * ZISO AI 用户管理工具
 * 支持隐式注册 (匿名用户) 和显式注册 (注册用户)
 * 
 * iOS PWA 兼容性说明：
 * 当用户将 PWA 添加到主屏幕时，iOS 会创建一个独立的 WebView 沙箱，
 * 其 localStorage 与 Safari 完全隔离。为解决此问题，我们同时将用户 ID
 * 存储在 Cookie 中作为备份，当 localStorage 为空时尝试从 Cookie 恢复。
 */

const USER_ID_KEY = 'STOCKWISE_USER_ID';
const USER_TYPE_KEY = 'STOCKWISE_USER_TYPE';
const USERNAME_KEY = 'STOCKWISE_USERNAME';
const USER_ID_COOKIE = 'stockwise_uid';
const USER_ID_URL_PARAM = 'uid';
const USER_SESSION_SYNC_KEY = 'STOCKWISE_USER_SESSION_SYNCED_AT';
const USER_SESSION_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_SYNC_COOKIE = 'stockwise_ssync';
const SESSION_SYNC_COOKIE_TTL_MIN = 30;
const LOCALE_STORAGE_KEY = 'stockwise_locale';
const LOCALE_COOKIE_KEY = 'ziso_locale';

export type RegistrationType = 'anonymous' | 'explicit';

export interface User {
  userId: string;
  username?: string;
  registrationType: RegistrationType;
}

interface GetCurrentUserOptions {
  forceSessionSync?: boolean;
  waitForSessionSync?: boolean;
}

function inferLocaleFromToken(value: string | null | undefined): 'cn' | 'en' | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'cn' || normalized === 'zh' || normalized.startsWith('zh-')) return 'cn';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
}

function getInitialLocale(): 'cn' | 'en' {
  if (typeof window === 'undefined') return 'en';
  const stored = inferLocaleFromToken(localStorage.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;
  const cookieLocale = inferLocaleFromToken(getCookie(LOCALE_COOKIE_KEY));
  if (cookieLocale) return cookieLocale;
  return inferLocaleFromToken(navigator.language) ?? 'en';
}

let pendingUserSessionSync: Promise<void> | null = null;

async function syncCurrentUserSession(
  userId: string,
  userType: RegistrationType,
  forceSessionSync: boolean
): Promise<void> {
  // Cross-tab dedup: short-lived cookie survives new tabs, preventing redundant register POSTs.
  // sessionStorage alone resets per-tab, causing every new tab to fire a register call.
  const crossTabSynced = getCookie(SESSION_SYNC_COOKIE) === '1';
  const lastSyncAt = Number(sessionStorage.getItem(USER_SESSION_SYNC_KEY) || '0');
  const shouldSyncSession =
    forceSessionSync || (!crossTabSynced && (Date.now() - lastSyncAt > USER_SESSION_SYNC_INTERVAL_MS));

  if (!shouldSyncSession) {
    setCookie(USER_ID_COOKIE, userId);
    return;
  }

  if (!pendingUserSessionSync) {
    pendingUserSessionSync = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch('/api/user/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            registrationType: userType || 'anonymous',
            locale: getInitialLocale(),
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error('❌ 用户会话同步失败:', response.status);
          setCookie(USER_ID_COOKIE, userId);
          return;
        }

        const data = await response.json();
        const syncedUserId = data?.userId && data.userId !== userId ? data.userId : userId;
        syncUserIdToStorage(syncedUserId, userType || 'anonymous');
        sessionStorage.setItem(USER_SESSION_SYNC_KEY, String(Date.now()));
        setCookie(SESSION_SYNC_COOKIE, '1', SESSION_SYNC_COOKIE_TTL_MIN / (24 * 60));
        console.log('✅ 用户会话已同步:', syncedUserId);
      } catch (error) {
        console.error('❌ 用户会话同步失败或超时:', error);
        setCookie(USER_ID_COOKIE, userId);
      } finally {
        pendingUserSessionSync = null;
      }
    })();
  }

  await pendingUserSessionSync;
}

/**
 * 生成短格式 User ID (user_xxx)
 * 统一的 ID 生成入口，确保全局一致性
 */
function generateShortId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

function isValidUserId(input: string | null | undefined): input is string {
  return typeof input === 'string' && /^user_[A-Za-z0-9_-]{6,64}$/.test(input);
}

/**
 * 从 Cookie 中读取值
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * 设置 Cookie（长期有效，用于 iOS PWA 身份恢复）
 */
function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  // SameSite=Lax 以支持 PWA 场景，Secure 在 https 下启用
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';

  // 关键修改：设置 Domain 为顶级域名（.ziso.cc），以便在 app.ziso.cc 和 ziso.cc 之间共享 Cookie
  // 本地开发 (localhost) 时不设置 Domain
  const hostname = window.location.hostname;
  const domainAttr = hostname.includes('ziso.cc') ? '; domain=.ziso.cc' : '';

  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${secure}${domainAttr}`;
}

function getUserIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const userId = url.searchParams.get(USER_ID_URL_PARAM);
  return isValidUserId(userId) ? userId : null;
}

function syncUserIdToInstallUrl(userId: string): void {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as Record<string, unknown>).standalone === true;

  // Only bridge in iOS browser mode so A2HS icon launch URL carries the same identity.
  if (!isIOS || isStandalone) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get(USER_ID_URL_PARAM) === userId) return;
  url.searchParams.set(USER_ID_URL_PARAM, userId);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * 同步用户 ID 到所有存储位置
 */
function syncUserIdToStorage(userId: string, userType: RegistrationType): void {
  localStorage.setItem(USER_ID_KEY, userId);
  localStorage.setItem(USER_TYPE_KEY, userType);
  setCookie(USER_ID_COOKIE, userId);
}

/**
 * 获取当前用户 (隐式注册)
 * 如果不存在则自动创建匿名用户
 * 
 * 恢复优先级：
 * 1. localStorage（正常浏览器环境）
 * 2. Cookie（iOS PWA 主屏幕应用恢复）
 * 3. 创建新用户（首次访问）
 */
export async function getCurrentUser(options: GetCurrentUserOptions = {}): Promise<User> {
  if (typeof window === 'undefined') {
    // SSR 环境，返回临时用户
    return {
      userId: 'temp-ssr-user',
      registrationType: 'anonymous',
    };
  }

  let userId = localStorage.getItem(USER_ID_KEY);
  let userType = localStorage.getItem(USER_TYPE_KEY) as RegistrationType;
  const username = localStorage.getItem(USERNAME_KEY) || undefined;

  // A2HS bridge: recover from install URL if local storage is isolated (iOS standalone cold start).
  if (!userId) {
    const urlUserId = getUserIdFromUrl();
    if (urlUserId) {
      console.log('🔄 从 URL 恢复用户 ID（A2HS bridge）:', urlUserId);
      userId = urlUserId;
      userType = 'anonymous';
      localStorage.setItem(USER_ID_KEY, userId);
      localStorage.setItem(USER_TYPE_KEY, userType);
    }
  }

  // 如果 localStorage 没有 userId，尝试从 Cookie 恢复（iOS PWA 场景）
  if (!userId) {
    const cookieUserId = getCookie(USER_ID_COOKIE);
    if (isValidUserId(cookieUserId)) {
      console.log('🔄 从 Cookie 恢复用户 ID（iOS PWA 模式）:', cookieUserId);
      userId = cookieUserId;
      userType = 'anonymous';
      // 同步回 localStorage
      localStorage.setItem(USER_ID_KEY, userId);
      localStorage.setItem(USER_TYPE_KEY, userType);
    }
  }

  // 如果仍然没有 userId，创建新的匿名用户
  if (!userId) {
    userId = generateShortId();
    userType = 'anonymous';

    // 先保存到 localStorage 和 Cookie，保证前端即时可用
    syncUserIdToStorage(userId, userType);
  }

  if (userId) {
    syncUserIdToInstallUrl(userId);
  }

  if (!userId) {
    userId = generateShortId();
    userType = 'anonymous';
    syncUserIdToStorage(userId, userType);
  }

  const shouldWaitForSessionSync =
    options.forceSessionSync || options.waitForSessionSync !== false;
  if (shouldWaitForSessionSync) {
    await syncCurrentUserSession(userId, userType || 'anonymous', options.forceSessionSync === true);
  } else {
    void syncCurrentUserSession(userId, userType || 'anonymous', options.forceSessionSync === true);
  }

  return {
    userId,
    username,
    registrationType: userType || 'anonymous',
  };
}

/**
 * 手动恢复用户身份（用于 iOS PWA 等场景下的身份找回）
 * 用户可以输入之前的 userId 来恢复自己的账户
 */
export async function restoreUserIdentity(targetUserId: string): Promise<{ success: boolean; message: string }> {
  if (!targetUserId || !targetUserId.startsWith('user_')) {
    return { success: false, message: '无效的用户 ID 格式' };
  }

  try {
    // 使用专用恢复接口，不依赖当前 session（目的就是切换身份）
    // 注意：不能走 /api/user/register，因为那个接口会优先信任 session cookie 中的当前身份
    const response = await fetch('/api/user/recovery/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data?.success) {
      return { success: false, message: data?.error || '用户身份恢复失败，请稍后重试' };
    }

    // 恢复用户身份到本地存储（服务端已同步更新 session cookie）
    syncUserIdToStorage(targetUserId, 'anonymous');
    // 清除 session sync 标记，确保下次加载时重新同步
    sessionStorage.removeItem(USER_SESSION_SYNC_KEY);

    console.log('✅ 用户身份恢复成功:', targetUserId);
    return { success: true, message: data.message || '身份恢复成功！请刷新页面。' };
  } catch (error) {
    console.error('❌ 身份恢复失败:', error);
    return { success: false, message: '恢复过程中出现错误，请稍后重试' };
  }
}

/**
 * 获取当前用户 ID（仅同步读取，不会创建新用户）
 * 用于快速获取 userId 显示等场景
 */
export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_ID_KEY) || getCookie(USER_ID_COOKIE);
}

/**
 * 升级为注册用户 (显式注册)
 */
export async function upgradeToExplicitUser(username: string): Promise<boolean> {
  await getCurrentUser();

  try {
    const response = await fetch('/api/user/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
      }),
    });

    if (response.ok) {
      // 更新 localStorage
      localStorage.setItem(USER_TYPE_KEY, 'explicit');
      localStorage.setItem(USERNAME_KEY, username);
      console.log('✅ 用户升级成功:', username);
      return true;
    } else {
      console.error('❌ 用户升级失败:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('❌ 用户升级失败:', error);
    return false;
  }
}

/**
 * 更新用户最后活跃时间
 */
export async function updateLastActive(): Promise<void> {
  await getCurrentUser();

  try {
    await fetch('/api/user/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ 更新活跃时间失败:', error);
  }
}

/**
 * 获取用户显示名称
 */
export function getUserDisplayName(user: User): string {
  if (user.username) {
    return user.username;
  }
  if (user.registrationType === 'anonymous') {
    return '访客用户';
  }
  return '未知用户';
}
