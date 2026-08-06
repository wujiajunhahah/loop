"""统一数据读取器。

兼容两种来源，格式完全一致：
  1) 官方 14 天样例：data/sample_data/sample_14days_*.csv
  2) App「历史数据」页同步后导出的 CSV

Measurement 列: time,hr,hrv,spo2,respRate,hrSuccess,spo2Success
Activity    列: time,batteryPercent,steps,activeSeconds,temperaturesC

注意：
- 无效读数用占位值 18 填充，必须用 *_Success 标志过滤，不要用数值判断。
- respRate 放大 10 倍存储（124 -> 12.4 次/分），读取时除以 10。
- temperaturesC 为分号分隔的 15 个皮肤温度采样。
"""
import numpy as np
import pandas as pd

MEASUREMENT_HEADER = ["time", "hr", "hrv", "spo2", "respRate", "hrSuccess", "spo2Success"]
ACTIVITY_HEADER = ["time", "batteryPercent", "steps", "activeSeconds", "temperaturesC"]


_CANONICAL = {
    "time": "time",
    "hr": "hr",
    "hrv": "hrv",
    "spo2": "spo2",
    "resprate": "respRate",
    "hrsuccess": "hrSuccess",
    "spo2success": "spo2Success",
    "batterypercent": "batteryPercent",
    "steps": "steps",
    "activeseconds": "activeSeconds",
    "temperaturesc": "temperaturesC",
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [_CANONICAL.get(c.strip().lower(), c.strip()) for c in df.columns]
    return df


def load_measurement(path) -> pd.DataFrame:
    """读取测量 CSV，返回按时间升序的原始 DataFrame（respRate 已还原为 bpm）。"""
    df = _normalize_columns(pd.read_csv(path))
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df = df.sort_values("time").reset_index(drop=True)
    return df


def valid_measurement(df: pd.DataFrame) -> pd.DataFrame:
    """返回副本：无效读数置为 NaN（用 *_Success 标志过滤）。

    hr/hrv 的可用性由 hrSuccess 决定；spo2/respRate 由 spo2Success 决定。
    """
    v = df.copy()
    v["hr"] = v["hr"].where(v["hrSuccess"])
    v["hrv"] = v["hrv"].where(v["hrSuccess"])
    v["spo2"] = v["spo2"].where(v["spo2Success"])
    v["respRate"] = v["respRate"].where(v["spo2Success"])
    return v


def load_activity(path) -> pd.DataFrame:
    """读取活动 CSV，并把分号分隔的皮肤温度展开为 tempC_mean。"""
    df = _normalize_columns(pd.read_csv(path))
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df = df.sort_values("time").reset_index(drop=True)
    df = df.rename(columns={"temperaturesc": "temperaturesC"})
    temps = df["temperaturesC"].astype(str).str.split(";")
    df["tempC_list"] = temps
    df["tempC_mean"] = temps.apply(
        lambda xs: float(np.mean([float(x) for x in xs])) if xs else np.nan
    )
    return df


def describe_valid(df: pd.DataFrame) -> pd.DataFrame:
    """输出各字段的有效读数统计，快速了解数据质量。"""
    v = valid_measurement(df)
    rows = []
    for col in ["hr", "hrv", "spo2", "respRate"]:
        s = v[col].dropna()
        rows.append(
            {
                "field": col,
                "valid_count": len(s),
                "valid_ratio": len(s) / max(len(df), 1),
                "min": s.min() if len(s) else np.nan,
                "max": s.max() if len(s) else np.nan,
                "mean": s.mean() if len(s) else np.nan,
            }
        )
    return pd.DataFrame(rows)
