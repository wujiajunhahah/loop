"""EDA：字段理解 + 统计 + 可视化。

用法（在 pc/ 目录下）：
    python eda.py
输出写入 output/。
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from loader import describe_valid, load_activity, load_measurement, valid_measurement

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parent / "data" / "sample_data"
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

CN_TIMEZONE = "Asia/Shanghai"


def main():
    meas_path = DATA_DIR / "sample_14days_Measurement.csv"
    act_path = DATA_DIR / "sample_14days_Activity.csv"

    m = load_measurement(meas_path)
    a = load_activity(act_path)

    print("=" * 60)
    print("测量数据概览")
    print("=" * 60)
    print(f"总行数: {len(m)}  时间范围: {m.time.min()} ~ {m.time.max()}")
    print(describe_valid(m).to_string(index=False))

    print()
    print("=" * 60)
    print("活动数据概览")
    print("=" * 60)
    print(f"总行数: {len(a)}  时间范围: {a.time.min()} ~ {a.time.max()}")
    print(
        a[["batteryPercent", "steps", "activeSeconds", "tempC_mean"]]
        .describe()
        .to_string()
    )

    mv = valid_measurement(m).set_index("time")

    plot_timeseries(mv)
    plot_circadian(mv, a)
    plot_hrv_scatter(mv)
    plot_daily(a)

    print()
    print(f"图表已写入: {OUT}")


def plot_timeseries(mv: pd.DataFrame):
    fig, axes = plt.subplots(3, 1, figsize=(15, 10), sharex=True)
    axes[0].plot(mv.index, mv.hr, lw=0.8, label="HR", color="#4ade80")
    axes[0].plot(mv.index, mv.hrv, lw=0.8, label="HRV", color="#f472b6")
    axes[0].set_ylabel("HR(bpm) / HRV")
    axes[0].legend(loc="upper right")
    axes[1].plot(mv.index, mv.spo2, lw=0.8, label="SpO2", color="#fca5a5")
    axes[1].set_ylabel("SpO2(%)")
    axes[1].set_ylim(80, 102)
    axes[1].legend(loc="upper right")
    axes[2].plot(mv.index, mv.respRate, lw=0.8, label="呼吸率", color="#93c5fd")
    axes[2].set_ylabel("呼吸率(bpm)")
    axes[2].legend(loc="upper right")
    axes[2].set_xlabel("时间 (UTC)")
    fig.suptitle("14 天测量数据时序")
    fig.tight_layout()
    fig.savefig(OUT / "timeseries_14days.png", dpi=130)
    plt.close(fig)


def plot_circadian(mv: pd.DataFrame, a: pd.DataFrame):
    mv_cn = mv.copy()
    mv_cn["hour"] = mv_cn.index.tz_convert(CN_TIMEZONE).hour
    hr_hourly = mv_cn.groupby("hour")["hr"].mean()
    hrv_hourly = mv_cn.groupby("hour")["hrv"].mean()

    a_cn = a.copy()
    a_cn["hour"] = a_cn.time.dt.tz_convert(CN_TIMEZONE).dt.hour
    steps_hourly = a_cn.groupby("hour")["steps"].sum()

    fig, axes = plt.subplots(2, 1, figsize=(12, 8))
    axes[0].bar(hr_hourly.index - 0.2, hr_hourly.values, width=0.4, label="HR(平均)", color="#4ade80")
    axes[0].bar(hrv_hourly.index + 0.2, hrv_hourly.values, width=0.4, label="HRV(平均)", color="#f472b6")
    axes[0].set_xticks(range(0, 24, 2))
    axes[0].set_ylabel("HR / HRV")
    axes[0].set_title("昼夜节律（北京时区）")
    axes[0].legend()
    axes[1].bar(steps_hourly.index, steps_hourly.values, color="#60a5fa")
    axes[1].set_xticks(range(0, 24, 2))
    axes[1].set_ylabel("步数(累计)")
    axes[1].set_title("每小时步数分布")
    fig.tight_layout()
    fig.savefig(OUT / "circadian.png", dpi=130)
    plt.close(fig)


def plot_hrv_scatter(mv: pd.DataFrame):
    d = mv[["hr", "hrv"]].dropna()
    fig, ax = plt.subplots(figsize=(8, 7))
    ax.scatter(d.hr, d.hrv, s=8, alpha=0.4, color="#818cf8")
    ax.set_xlabel("HR (bpm)")
    ax.set_ylabel("HRV")
    ax.set_title("HR vs HRV（HRV 高通常更平静）")
    fig.tight_layout()
    fig.savefig(OUT / "hrv_vs_hr.png", dpi=130)
    plt.close(fig)


def plot_daily(a: pd.DataFrame):
    a_cn = a.copy()
    a_cn["date"] = a_cn.time.dt.tz_convert(CN_TIMEZONE).dt.date
    daily = a_cn.groupby("date").agg({"steps": "sum", "batteryPercent": "mean"}).reset_index()

    fig, axes = plt.subplots(2, 1, figsize=(15, 8), sharex=True)
    axes[0].bar(range(len(daily)), daily.steps, color="#34d399")
    axes[0].set_ylabel("每日步数")
    axes[0].set_title("每日活动汇总")
    axes[1].plot(range(len(daily)), daily.batteryPercent, "o-", color="#fbbf24")
    axes[1].set_ylabel("电量均值(%)")
    axes[1].set_ylim(0, 100)
    axes[1].set_xticks(range(len(daily)))
    axes[1].set_xticklabels([str(d) for d in daily.date], rotation=45, ha="right")
    fig.tight_layout()
    fig.savefig(OUT / "daily_activity.png", dpi=130)
    plt.close(fig)


if __name__ == "__main__":
    sys.exit(main())
