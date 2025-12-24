'use client';

/**
 * StockWise 用户管理工具
 * 支持隐式注册 (匿名用户) 和显式注册 (注册用户)
 */

const USER_ID_KEY = 'stockwise_user_id';
const USER_TYPE_KEY = 'stockwise_user_type';
const USERNAME_KEY = 'stockwise_username';

export type RegistrationType = 'anonymous' | 'explicit';

export interface User {
  userId: string;
  username?: string;
  registrationType: RegistrationType;
}

/**
 * 生成 UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取当前用户 (隐式注册)
 * 如果不存在则自动创建匿名用户
 */
export async function getCurrentUser(): Promise<User> {
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

  // 如果没有 userId，创建新的匿名用户
  if (!userId) {
    userId = generateUUID();
    userType = 'anonymous';

    // 保存到 localStorage
    localStorage.setItem(USER_ID_KEY, userId);
    localStorage.setItem(USER_TYPE_KEY, userType);

    // 调用后端 API 注册用户
    try {
      await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          registrationType: 'anonymous',
        }),
      });
      console.log('✅ 匿名用户注册成功:', userId);
    } catch (error) {
      console.error('❌ 匿名用户注册失败:', error);
    }
  }

  return {
    userId,
    username,
    registrationType: userType || 'anonymous',
  };
}

/**
 * 升级为注册用户 (显式注册)
 */
export async function upgradeToExplicitUser(username: string): Promise<boolean> {
  const user = await getCurrentUser();

  try {
    const response = await fetch('/api/user/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
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
  const user = await getCurrentUser();

  try {
    await fetch('/api/user/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.userId }),
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
