from backend.scripts.run_min_tradeability_loop import Bar, resolve_execution_costs, run_loop


def _bar(date: str, close: float, open_: float | None = None, ma5: float = 9.9, ma10: float = 9.8, ma20: float = 9.7, volume: float = 100.0, change_percent: float = 1.0, macd_hist: float = 0.1, high: float | None = None, low: float | None = None) -> Bar:
    return Bar(
        symbol="000001",
        date=date,
        open=close if open_ is None else open_,
        high=(close + 0.5) if high is None else high,
        low=(close - 0.5) if low is None else low,
        close=close,
        volume=volume,
        change_percent=change_percent,
        ma5=ma5,
        ma10=ma10,
        ma20=ma20,
        macd_hist=macd_hist,
    )


def test_run_loop_execution_costs_reduce_returns():
    history = []
    for i in range(16):
        history.append(_bar(f"2026-01-{i+1:02d}", close=10.0, open_=10.0, ma5=9.8, ma10=9.7, ma20=9.6, volume=100.0, change_percent=0.5, macd_hist=0.1, high=12.0, low=8.0))
    for i in range(4):
        history.append(_bar(f"2026-01-{17+i:02d}", close=10.0, open_=10.0, ma5=9.9, ma10=9.8, ma20=9.7, volume=100.0, change_percent=0.8, macd_hist=0.1, high=10.2, low=9.8))
    history.append(_bar("2026-01-21", close=10.9, open_=10.5, ma5=10.1, ma10=10.0, ma20=9.9, volume=200.0, change_percent=4.5, macd_hist=0.3, high=11.0, low=10.0))
    history.append(_bar("2026-01-22", close=11.1, open_=11.0, ma5=10.3, ma10=10.2, ma20=10.0, volume=120.0, change_percent=1.0, macd_hist=0.35, high=11.3, low=10.8))
    history.append(_bar("2026-01-23", close=11.4, open_=11.2, ma5=10.5, ma10=10.4, ma20=10.1, volume=110.0, change_percent=1.2, macd_hist=0.36, high=11.5, low=11.0))
    history.append(_bar("2026-01-24", close=11.2, open_=11.3, ma5=10.6, ma10=10.5, ma20=10.2, volume=105.0, change_percent=-0.3, macd_hist=0.34, high=11.4, low=11.0))
    history.append(_bar("2026-01-25", close=11.3, open_=11.2, ma5=10.7, ma10=10.6, ma20=10.3, volume=103.0, change_percent=0.4, macd_hist=0.33, high=11.4, low=11.1))
    history.append(_bar("2026-01-26", close=11.5, open_=11.4, ma5=10.8, ma10=10.7, ma20=10.4, volume=101.0, change_percent=0.6, macd_hist=0.32, high=11.6, low=11.2))

    bars = {"000001": history}
    kwargs = dict(
        bars_by_symbol=bars,
        max_hold_days=1,
        stop_loss_pct=0.06,
        vcp_ratio=0.9,
        risk_off_ma=10,
        breakout_volume_mult=1.1,
        strong_close_threshold=0.65,
        momentum_change_threshold=4.0,
        initial_capital=1_000_000.0,
        max_positions=10,
        fee_bps_each_side=5.0,
    )

    base = run_loop(**kwargs, spread_bps=0.0, slippage_bps=0.0)
    with_cost = run_loop(**kwargs, spread_bps=10.0, slippage_bps=15.0)

    assert base["trade_metrics"]["trade_count"] == with_cost["trade_metrics"]["trade_count"] == 1.0
    assert with_cost["trade_metrics"]["expectancy"] < base["trade_metrics"]["expectancy"]
    assert with_cost["all_trades"][0]["entry_price"] > base["all_trades"][0]["entry_price"]
    assert with_cost["all_trades"][0]["exit_price"] < base["all_trades"][0]["exit_price"]


def test_liquidity_bucketed_costs_scale_down_for_large_cn():
    history = []
    for i in range(25):
        history.append(_bar(f"2026-02-{i+1:02d}", close=10.0, volume=60_000_000.0, high=10.4, low=9.6))

    spread_bps, slippage_bps, bucket = resolve_execution_costs(
        symbol="600519",
        history=history,
        signal_idx=24,
        market="CN",
        spread_bps=0.0,
        slippage_bps=0.0,
        execution_cost_profile="liquidity_bucketed",
    )

    assert bucket == "large"
    assert spread_bps == 4.0
    assert slippage_bps == 6.0


def test_liquidity_bucketed_costs_scale_up_for_small_hk():
    history = []
    for i in range(25):
        history.append(_bar(f"2026-03-{i+1:02d}", close=2.0, volume=800_000.0, high=2.1, low=1.9))

    spread_bps, slippage_bps, bucket = resolve_execution_costs(
        symbol="00295",
        history=history,
        signal_idx=24,
        market="HK",
        spread_bps=0.0,
        slippage_bps=0.0,
        execution_cost_profile="liquidity_bucketed",
    )

    assert bucket == "small"
    assert spread_bps == 16.0
    assert slippage_bps == 30.0
