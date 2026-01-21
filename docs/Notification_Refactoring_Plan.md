# Notification System Refactoring - Phased Implementation

## Guiding Principles
1. **Backward Compatible:** New code must not break existing functionality.
2. **Feature Flagged:** New notification logic can be disabled via environment variable.
3. **Testable First:** Write tests before or alongside implementation.
4. **Incremental Rollout:** Each phase is independently deployable.

---

## Phase 1: Database Schema Extension ✅ COMPLETED

### Files Modified
- `backend/database.py`: Added `notification_logs`, `signal_states` tables, and `notification_settings` column.

### Files Created
- `backend/tests/test_notification_schema.py`: Unit tests passing.

---

## Phase 2: NotificationManager Core ✅ COMPLETED

### Files Created
- `backend/notification_service.py`: Core logic with user preference checking.
- `backend/tests/test_notification_service.py`: 7 unit tests passing.

### Key Features
- Signal flip detection
- Notification aggregation
- User preference checking (`_check_user_preference`)
- Dry-run mode for testing
- Analytics logging to `notification_logs`

---

## Phase 3: Integration with Runner ✅ COMPLETED

### Files Modified
- `backend/analysis/runner.py`: Conditional integration with feature flag.
- `backend/config.py`: Added `ENABLE_SMART_NOTIFICATIONS` flag.

### Feature Flag
```python
ENABLE_SMART_NOTIFICATIONS = os.getenv("ENABLE_SMART_NOTIFICATIONS", "false").lower() == "true"
```

---

## Phase 4: Scheduled Jobs ✅ COMPLETED

### Files Created
- `backend/scripts/daily_morning_call.py`: 08:30 morning briefing
- `backend/scripts/daily_validation_check.py`: 16:30 validation success alerts
- `.github/workflows/daily_morning_call.yml`: GHA scheduled workflow
- `.github/workflows/daily_validation_check.yml`: GHA scheduled workflow

---

## Phase 4.5: Frontend Notification Settings ✅ COMPLETED

### Goal
Allow users to granularly control which notification types they receive.

### Files Created
- `frontend/src/app/api/user/notification-settings/route.ts`: API for GET/POST settings

### Files Modified
- `frontend/src/components/UserCenterDrawer.tsx`: Expandable notification type settings panel

### Notification Types
| Type       | Key                  | Description     |
| ---------- | -------------------- | --------------- |
| 🚨 信号翻转 | `signal_flip`        | AI 观点重大转变 |
| ☕ 每日早报 | `morning_call`       | 08:30 开盘提醒  |
| 🏅 验证战报 | `validation_glory`   | 预测成功反馈    |
| 🤖 预测更新 | `prediction_updated` | 分析完成通知    |
| 📊 简报生成 | `daily_brief`        | 个性化简报就绪  |

### Data Schema
```json
{
  "enabled": true,
  "types": {
    "signal_flip": { "enabled": true, "priority": "high" },
    "morning_call": { "enabled": true, "priority": "medium" },
    "validation_glory": { "enabled": true, "priority": "medium" },
    "prediction_updated": { "enabled": true, "priority": "low" },
    "daily_brief": { "enabled": true, "priority": "low" }
  }
}
```

---

## Phase 5: Deprecate Legacy user_tracker.py ⏳ PENDING

### Goal
Remove old notification logic after new system is verified in production.

### Files to Modify
- `backend/analysis/runner.py`: Remove `UserCompletionTracker` usage.
- `backend/analysis/user_tracker.py`: Mark as deprecated or delete.

### Pre-requisite
- Phase 3 has been running in production for at least 1 week without issues.

---

## Implementation Status Summary

| Phase                        | Status    | Notes                                     |
| ---------------------------- | --------- | ----------------------------------------- |
| Phase 1: DB Schema           | ✅ Done    | Tables created, migration added           |
| Phase 2: Core Logic          | ✅ Done    | NotificationManager with preference check |
| Phase 3: Runner Integration  | ✅ Done    | Feature flagged                           |
| Phase 4: Scheduled Jobs      | ✅ Done    | GHA workflows ready                       |
| Phase 4.5: Frontend Settings | ✅ Done    | User preference UI                        |
| Phase 5: Legacy Cleanup      | ⏳ Pending | Wait 1 week                               |

---

## Environment Variables

| Variable                     | Description                     | Default  |
| ---------------------------- | ------------------------------- | -------- |
| `ENABLE_SMART_NOTIFICATIONS` | Enable new notification system  | `false`  |
| `INTERNAL_API_SECRET`        | Auth for push API               | Required |
| `NEXT_PUBLIC_SITE_URL`       | Base URL for notification links | Required |

---

## Success Criteria
1. ✅ All unit tests pass (`pytest backend/tests/`)
2. ✅ Frontend build succeeds
3. ⏳ Integration tests with feature flag ON
4. ⏳ No increase in error rate in production logs
5. ⏳ CTR tracking data appears in `notification_logs` after 24 hours

