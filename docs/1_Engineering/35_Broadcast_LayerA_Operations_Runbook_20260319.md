# Broadcast Layer A Operations Runbook (2026-03-19)

## Scope
- Baseline guarantee for broadcast production readiness:
  - Observation
  - Reconciliation
  - Fallback visibility

## Data Sources
- `ops_broadcast_health`
  - Synthetic probes for `/api/stock/prices/all` (`all`, `hk`, `cn`)
  - Fields: `status_code`, `latency_ms`, `item_count`, `ok`, `error_message`, `checked_at`
- `ops_pool_reconcile_runs`
  - Reconcile runs for `global_stock_pool.watchers_count` against `user_watchlist`
  - Fields: mismatch before/after, updated/deleted rows, status, error
- `ops_broadcast_fallback_events`
  - Frontend-reported fallback events:
  - `broadcast_circuit_open`, `legacy_fallback_used`, `broadcast_recovered`

## Schedulers
- Workflow: `.github/workflows/broadcast_ops_guard.yml`
- Trigger:
  - Every 15 minutes
  - Manual dispatch
- Steps:
  - `broadcast_health_probe.py`
  - `reconcile_global_stock_pool.py`
  - ADMIN failure notification via WeCom

## Retention Policy
- Unified 30-day retention, executed during reconcile:
  - prune old rows from:
    - `ops_broadcast_health`
    - `ops_broadcast_fallback_events`
    - `ops_pool_reconcile_runs`

## Admin Visibility
- API: `/api/admin/observability/broadcast`
- Dashboard: `/admin/observability`
- Must-have signals:
  - Broadcast 24h ok rate
  - Fallback event counts (24h)
  - Latest reconcile status and mismatch before/after

## Go/No-Go Baseline (commercial readiness)
- **Go** when all hold for rolling 24h:
  - `broadcast ok_rate_24h >= 0.98`
  - `circuit_open_24h = 0` (or brief single event with recovery)
  - latest reconcile `status = success` and `mismatch_after = 0`
- **No-Go** when any holds:
  - probe failures continue for > 30 minutes
  - repeated circuit open events without recovery
  - reconcile failures or `mismatch_after > 0`

## Incident First Actions
- Confirm latest failed probe and market (`all`/`hk`/`cn`)
- Check whether fallback events are rising in the same window
- Run manual dispatch for `broadcast_ops_guard.yml`
- If unresolved, keep legacy fallback path active and avoid enabling further broadcast expansion until stable
