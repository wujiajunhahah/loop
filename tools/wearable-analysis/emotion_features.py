"""HRV / 情绪特征提取 —— B 方案第一阶段的核心。

输入粒度：Measurement 每 2.5 分钟、Activity 每 15 分钟。
思路：
  1. 按统一时间窗（默认 30 分钟）重采样出 HR / HRV / SpO2 / 呼吸率均值；
  2. 每个信号算出「压力分量」0~1（越接近 1 越像高压力信号）；
  3. 加权合并为可解释的 stress_index（0~1）；
  4. 结合活动量区分「运动中高心率」与「静息压力」，输出情绪状态基线。

参考区间来自 sample_data README 中的生理合理范围，可后续用真机数据重标定。
"""
import numpy as np
import pandas as pd

from loader import load_activity, load_measurement, valid_measurement

REF = {
    "hr": (55.0, 95.0),
    "hrv": (20.0, 110.0),
    "spo2": (94.0, 100.0),
    "resp": (10.0, 20.0),
}

DEFAULT_WEIGHTS = {"s_hr": 0.4, "s_hrv": 0.4, "s_spo2": 0.1, "s_resp": 0.1}

STATE_LABELS = {"unknown": "数据不足", "active": "活跃/运动", "stressed": "压力偏高", "calm": "平静"}


def _clamp_norm(value, lo, hi, invert=False):
    if pd.isna(value):
        return np.nan
    x = (float(value) - lo) / (hi - lo)
    x = max(0.0, min(1.0, x))
    return 1.0 - x if invert else x


def stress_components(row: pd.Series) -> dict:
    """各信号的「压力分量」0~1，1 表示高压力信号。"""
    return {
        "s_hr": _clamp_norm(row.get("hr"), *REF["hr"]),
        "s_hrv": _clamp_norm(row.get("hrv"), *REF["hrv"], invert=True),
        "s_spo2": _clamp_norm(row.get("spo2"), *REF["spo2"], invert=True),
        "s_resp": _clamp_norm(row.get("respRate"), *REF["resp"]),
    }


def stress_index(components: dict, weights: dict | None = None) -> float:
    """加权压力指数，只对可用的分量做归一化加权。"""
    weights = weights or DEFAULT_WEIGHTS
    available = {k: components[k] for k in weights if not pd.isna(components.get(k))}
    if not available:
        return np.nan
    w = np.array([weights[k] for k in available])
    w = w / w.sum()
    return float(np.average(list(available.values()), weights=w))


def classify_state(row: pd.Series, active_sec_thresh: int = 300, steps_thresh: int = 300,
                   stress_thresh: float = 0.60) -> str:
    """结合活动量把窗口分类为情绪状态。"""
    if pd.isna(row.get("stress_index")):
        return "unknown"
    if row.get("activeSeconds", 0) >= active_sec_thresh or row.get("steps", 0) >= steps_thresh:
        return "active"
    if row["stress_index"] >= stress_thresh:
        return "stressed"
    return "calm"


def build_features(meas_path: str, act_path: str | None = None, window: str = "30min",
                   weights: dict | None = None, smooth_windows: int = 4,
                   active_sec_thresh: int = 300, steps_thresh: int = 300,
                   stress_thresh: float = 0.60) -> pd.DataFrame:
    """生成统一时间窗的情绪特征表（含 stress_index 与情绪状态）。"""
    m = valid_measurement(load_measurement(meas_path)).set_index("time")
    df = pd.DataFrame(
        {
            "hr": m["hr"].resample(window).mean(),
            "hrv": m["hrv"].resample(window).mean(),
            "spo2": m["spo2"].resample(window).mean(),
            "respRate": m["respRate"].resample(window).mean(),
            "n_valid_hr": m["hr"].resample(window).count(),
        }
    )

    if act_path:
        a = load_activity(act_path).set_index("time")
        a_feat = a.resample(window).agg(
            {"steps": "sum", "activeSeconds": "sum", "batteryPercent": "mean", "tempC_mean": "mean"}
        )
        df = df.join(a_feat, how="outer").sort_index()
        df["steps"] = df["steps"].fillna(0)
        df["activeSeconds"] = df["activeSeconds"].fillna(0)

    comps = df.apply(lambda r: pd.Series(stress_components(r)), axis=1)
    df["stress_index"] = comps.apply(lambda c: stress_index(c, weights), axis=1)
    df["stress_index_smooth"] = df["stress_index"].rolling(
        smooth_windows, min_periods=1, center=True
    ).mean()
    df["state"] = df.apply(
        lambda r: classify_state(
            r, active_sec_thresh, steps_thresh, stress_thresh
        ),
        axis=1,
    )
    df["state_label"] = df["state"].map(STATE_LABELS)
    df["hour_of_day"] = df.index.get_level_values(0).tz_convert("Asia/Shanghai").hour
    df["date"] = df.index.get_level_values(0).tz_convert("Asia/Shanghai").date
    return df
