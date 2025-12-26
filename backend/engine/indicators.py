import pandas as pd
import pandas_ta_classic as ta

# 解决 Pandas 2.2+ 的 FutureWarnings
pd.set_option('future.no_silent_downcasting', True)

def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """计算技术指标"""
    if df.empty:
        return df

    # SMA
    df["ma5"] = ta.sma(df["close"], length=5)
    df["ma10"] = ta.sma(df["close"], length=10)
    df["ma20"] = ta.sma(df["close"], length=20)
    df["ma60"] = ta.sma(df["close"], length=60)
    
    for col in ["ma5", "ma10", "ma20", "ma60"]:
        if isinstance(df[col], pd.DataFrame):
            df[col] = df[col].iloc[:, 0]
    
    # MACD
    macd = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd is not None:
        df["macd"] = macd.iloc[:, 0]
        df["macd_signal"] = macd.iloc[:, 1]
        df["macd_hist"] = macd.iloc[:, 2]
    
    # BBANDS
    bbands = ta.bbands(df["close"], length=20, std=2)
    if bbands is not None:
        df["boll_lower"] = bbands.iloc[:, 0]
        df["boll_mid"] = bbands.iloc[:, 1]
        df["boll_upper"] = bbands.iloc[:, 2]
    
    # RSI
    df["rsi"] = ta.rsi(df["close"], length=14)
    if isinstance(df["rsi"], pd.DataFrame):
        df["rsi"] = df["rsi"].iloc[:, 0]
    
    # KDJ
    stoch = ta.stoch(high=df["high"], low=df["low"], close=df["close"], k=9, d=3, smooth_k=3)
    if stoch is not None:
        df["kdj_k"] = stoch.iloc[:, 0]
        df["kdj_d"] = stoch.iloc[:, 1]
        df["kdj_j"] = 3 * stoch.iloc[:, 0] - 2 * stoch.iloc[:, 1]
    
    # 填充缺失值并类型转换
    df = df.fillna(0).infer_objects(copy=False)
    return df
