# 个人中心通知设置升级方案

## 📍 入口位置
在现有的 `UserCenterDrawer.tsx` 中的"推送通知"卡片（第 420-468 行）内部扩展。

## 🎨 UI 设计

### 升级前（当前）
```
┌─────────────────────────────────┐
│ 🔔 推送通知                      │
│ 获取股价异动与日报提醒           │
│                      [已开启]    │
└─────────────────────────────────┘
```

### 升级后
```
┌─────────────────────────────────┐
│ 🔔 推送通知                      │
│ 获取股价异动与日报提醒           │
│                      [已开启]    │
│ ─────────────────────────────── │
│ 通知类型设置              ▼     │
│                                 │
│ 🚨 信号翻转提醒      [●]        │
│    AI 观点重大转变时通知         │
│                                 │
│ ☕ 每日早报          [●]        │
│    开盘前市场概览 (08:30)        │
│                                 │
│ 🏅 预测验证战报      [●]        │
│    AI 预测成功反馈 (16:30)       │
│                                 │
│ 🤖 预测数据更新      [ ]        │
│    关注股票分析完成后            │
│                                 │
│ 📊 每日简报生成      [ ]        │
│    个性化简报准备就绪            │
└─────────────────────────────────┘
```

## 💻 代码实现

### 1. 新增 State

在 `UserCenterDrawer` 组件顶部添加：

```tsx
// 在第 41 行后添加
const [showNotificationSettings, setShowNotificationSettings] = useState(false);
const [notificationSettings, setNotificationSettings] = useState({
  enabled: true,
  types: {
    signal_flip: { enabled: true, priority: 'high' },
    morning_call: { enabled: true, priority: 'medium' },
    validation_glory: { enabled: true, priority: 'medium' },
    prediction_updated: { enabled: true, priority: 'low' },
    daily_brief: { enabled: true, priority: 'low' },
  },
});
```

### 2. 加载用户设置

在 `useEffect` 中添加设置加载逻辑（第 95 行后）：

```tsx
useEffect(() => {
  const loadNotificationSettings = async () => {
    if (!isOpen || !isSubscribed) return;
    
    try {
      const res = await fetch('/api/user/notification-settings');
      const data = await res.json();
      if (data.settings) {
        setNotificationSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load notification settings:', e);
    }
  };
  
  loadNotificationSettings();
}, [isOpen, isSubscribed]);
```

### 3. 切换通知类型

添加切换函数：

```tsx
const toggleNotificationType = async (typeKey: string) => {
  const newSettings = {
    ...notificationSettings,
    types: {
      ...notificationSettings.types,
      [typeKey]: {
        ...notificationSettings.types[typeKey],
        enabled: !notificationSettings.types[typeKey].enabled,
      },
    },
  };
  
  setNotificationSettings(newSettings);
  
  // 保存到后端
  try {
    await fetch('/api/user/notification-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: newSettings }),
    });
  } catch (e) {
    console.error('Failed to save settings:', e);
    setRedeemMsg({ type: 'error', text: '保存失败，请重试' });
  }
};
```

### 4. 修改现有的推送通知卡片

替换第 420-468 行的代码：

```tsx
{pushSupported && (
  <div className="glass-card p-5 mb-8">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pushPermission === 'granted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
          <Bell size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">推送通知</h4>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-slate-500">获取股价异动与日报提醒</p>
            {isSubscribed && (
              <button
                onClick={handleTestPush}
                disabled={testingPush}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 disabled:opacity-50"
              >
                {testingPush ? '发送中...' : '发送测试'}
              </button>
            )}
          </div>
        </div>
      </div>
      <div>
        {isSubscribed ? (
          <button
            onClick={handleDisableNotifications}
            disabled={isSubscribing}
            className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-red-400 hover:border-red-500/30 transition-all group/btn"
          >
            <span className="group-hover/btn:hidden">{isSubscribing ? '处理中...' : '已开启'}</span>
            <span className="hidden group-hover/btn:inline">关闭</span>
          </button>
        ) : (
          <button
            onClick={handleEnableNotifications}
            disabled={isSubscribing}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            {isSubscribing ? '开启中...' : '开启'}
          </button>
        )}
      </div>
    </div>
    
    {/* 🆕 详细设置区域 */}
    {isSubscribed && (
      <div className="mt-4 pt-4 border-t border-white/10">
        <button
          onClick={() => setShowNotificationSettings(!showNotificationSettings)}
          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <span className="font-bold">通知类型设置</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
        </button>
        
        <AnimatePresence>
          {showNotificationSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3">
                {[
                  { key: 'signal_flip', icon: '🚨', label: '信号翻转提醒', desc: 'AI 观点重大转变时通知' },
                  { key: 'morning_call', icon: '☕', label: '每日早报', desc: '开盘前市场概览 (08:30)' },
                  { key: 'validation_glory', icon: '🏅', label: '预测验证战报', desc: 'AI 预测成功反馈 (16:30)' },
                  { key: 'prediction_updated', icon: '🤖', label: '预测数据更新', desc: '关注股票分析完成后' },
                  { key: 'daily_brief', icon: '📊', label: '每日简报生成', desc: '个性化简报准备就绪' },
                ].map((type) => {
                  const isEnabled = notificationSettings.types[type.key]?.enabled;
                  return (
                    <div key={type.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-lg">{type.icon}</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white">{type.label}</p>
                          <p className="text-[9px] text-slate-600">{type.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleNotificationType(type.key)}
                        className={`w-10 h-6 rounded-full transition-all flex items-center ${
                          isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'
                        }`}
                      >
                        <motion.div
                          className="w-4 h-4 bg-white rounded-full shadow-lg mx-1"
                          layout
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )}
  </div>
)}
```

### 5. 添加必要的 import

在文件顶部（第 4 行）添加：

```tsx
import { X, User, Crown, Zap, ShieldCheck, Loader2, ArrowRight, Share2, Check, RefreshCw, Key, Bell, ChevronDown } from 'lucide-react';
```

## 🔌 后端 API

需要创建 `frontend/src/app/api/user/notification-settings/route.ts`（参考之前提供的代码）。

## ✅ 优势

1. **空间高效**：不占用 Dashboard 空间，复用现有个人中心
2. **渐进披露**：默认收起，高级用户可展开
3. **即时保存**：切换后立即同步到后端
4. **视觉一致**：延续您现有的设计风格

## 🎯 实施步骤

1. ✅ 添加后端 API (`/api/user/notification-settings`)
2. ✅ 修改 `UserCenterDrawer.tsx` 添加状态和逻辑
3. ✅ 更新数据库 Schema（添加 `notification_settings` 字段）
4. ✅ 后端通知服务集成用户偏好检查

---

**预计工作量**：2-3 小时
**风险等级**：低（仅扩展现有组件，不影响其他功能）
