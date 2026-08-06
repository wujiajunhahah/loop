"""B 方案核心：生成情绪/压力基线。

用法（在 tools/wearable-analysis/ 目录下）：
    python build_baseline.py

产出：
    output/emotion_baseline.csv   每时间窗的特征 + stress_index + 情绪状态
    output/stress_timeline.png    压力指数时序（含平滑）
    output/state_pie.png          情绪状态占比
    output/stress_by_hour.png     各时段压力分布
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from emotion_features import STATE_LABELS, build_features

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parents[1] / "data" / "sample_data"
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)

plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


def main():
    meas_path = DATA_DIR / "sample_14days_Measurement.csv"
    act_path = DATA_DIR / "sample_14days_Activity.csv"

    df = build_features(
        meas_path=str(meas_path),
        act_path=str(act_path),
        window="30min",
    )

    out_csv = OUT / "emotion_baseline.csv"
    df.to_csv(out_csv, index_label="time")
    print(f"特征表已写入: {out_csv}  ({len(df)} 行)")

    print()
    print("情绪状态占比（基线）:")
    dist = df["state"].value_counts()
    for state, cnt in dist.items():
        label = STATE_LABELS.get(state, state)
        print(f"  {label:<10} {cnt:>5}  ({cnt / max(len(df), 1) * 100:.1f}%)")

    print()
    print("压力指数统计:")
    print(df["stress_index"].describe().round(3).to_string())

    plot_stress_timeline(df)
    plot_state_pie(df)
    plot_stress_by_hour(df)
    print(f"图表已写入: {OUT}")


def plot_stress_timeline(df: pd.DataFrame):
    fig, axes = plt.subplots(2, 1, figsize=(15, 8), sharex=True)
    axes[0].plot(df.index, df.hr, lw=0.9, label="HR", color="#4ade80")
    axes[0].set_ylabel("HR(bpm)")
    axes[0].legend(loc="upper right")
    axes[1].plot(df.index, df.stress_index, lw=0.9, label="压力指数", color="#f87171")
    axes[1].plot(df.index, df.stress_index_smooth, lw=1.8, label="压力指数(平滑)", color="#dc2626")
    axes[1].axhline(0.6, ls="--", lw=0.8, color="#94a3b8")
    axes[1].set_ylabel("压力指数 0~1")
    axes[1].set_xlabel("时间 (UTC)")
    axes[1].legend(loc="upper right")
    fig.suptitle("30 分钟窗压力指数时序")
    fig.tight_layout()
    fig.savefig(OUT / "stress_timeline.png", dpi=130)
    plt.close(fig)


def plot_state_pie(df: pd.DataFrame):
    dist = df["state"].value_counts()
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.pie(
        dist.values,
        labels=[STATE_LABELS.get(s, s) for s in dist.index],
        autopct="%.1f%%",
        colors=["#94a3b8", "#60a5fa", "#f87171", "#34d399"],
    )
    ax.set_title("情绪状态占比（基线）")
    fig.tight_layout()
    fig.savefig(OUT / "state_pie.png", dpi=130)
    plt.close(fig)


def plot_stress_by_hour(df: pd.DataFrame):
    valid = df[df["state"] != "unknown"]
    by_hour = valid.groupby("hour_of_day")["stress_index"].agg(["mean", "count"]).reset_index()
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.bar(by_hour.hour_of_day, by_hour["mean"], color="#fca5a5")
    ax.set_xticks(range(0, 24, 2))
    ax.set_xlabel("小时（北京时区）")
    ax.set_ylabel("平均压力指数")
    ax.set_title("各时段平均压力（仅静息/活跃窗外）")
    fig.tight_layout()
    fig.savefig(OUT / "stress_by_hour.png", dpi=130)
    plt.close(fig)


if __name__ == "__main__":
    sys.exit(main())
