---
title: "Android 通知限制说明"
category: "通知与触达"
lastUpdated: "2026-03-04"
source_docs:
  - docs/3_Product/30_Notification_Strategy_Design.md
funnel_stage: "BOFU"
date: "2026-03-19"
publish:
  wechat:
    status: "none"
---

我们希望对您保持最大限度的透明：由于安卓生态的特殊性，ZISO AI 实时推送功能在**中国大陆地区的 Android 设备**上可能会遇到接收延迟或无法接收的情况。

### 为什么安卓收不到通知？
苹果设备 (iOS) 拥有统一的 APNs 级别推送服务，即使应用在后台也能秒级收到通知。而在中国大陆，Android 设备无法使用标准的 Google FCM 推送通道，且各家手机厂商 (华为、小米、OV等) 为了省电，对后台应用的查杀极其严苛。当 ZISO AI 在后台被清理后，就无法建立连接来接收服务器推送。

### 替代解决方案 (Fallback)
如果您使用的是 Android 设备，为了确保不错过关键变盘点：
1. **应用内查看**：系统产生的所有重要信号和复盘，都会在您打开应用时，同步在应用内的数据面板上。建议养成每天在关键时间节点（如早盘、尾盘）打开应用查看的习惯。
2. 保持网页在前台活跃访问期间，可以确保获取到最新的洞察分析。
