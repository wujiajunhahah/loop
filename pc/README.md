# PC 端分析管线（B 方案第一阶段）

读懂戒指数据 + 建立情绪/压力算法基线。全部基于 CSV，无需真机。

## 环境

```bash
pip install -r requirements.txt
# pandas numpy scipy matplotlib（已在本机装好）
```

## 目录结构

```text
loop/
├── app/                 # Alloop Kit Flutter / BLE 工程
├── data/sample_data/    # 14 天样例 CSV（与 App 导出格式一致）
└── pc/
    ├── loader.py            # 统一读取器（样例 / 真机导出通用）
    ├── eda.py               # 数据概览 + 图表
    ├── emotion_features.py  # 情绪 / 压力特征（核心算法）
    ├── build_baseline.py    # 生成情绪基线表 + 图表
    ├── requirements.txt
    └── output/              # 生成结果
```

## 运行

```bash
python eda.py              # 字段统计 + 时序/昼夜节律图
python build_baseline.py   # 30 分钟窗特征 + stress_index + 情绪状态
```

## 数据格式速查

| 文件 | 列 | 要点 |
| --- | --- | --- |
| Measurement | time,hr,hrv,spo2,respRate,hrSuccess,spo2Success | 2.5 分钟粒度；无效读数=占位 `18`，**用 `*Success` 过滤**；respRate 放大 10 倍（除以 10 得 bpm） |
| Activity | time,batteryPercent,steps,activeSeconds,temperaturesC | 15 分钟粒度；steps 是区间增量；temperaturesC 为分号分隔的 15 个温度 |

## 情绪/压力基线（emotion_features.py）

每 30 分钟一个窗口，每个信号算「压力分量」0~1，加权合并为 `stress_index`：

| 分量 | 含义 | 方向 |
| --- | --- | --- |
| s_hr | 心率 | 越高压力分量越大（默认权重 0.4） |
| s_hrv | 心率变异性 | 越低压力分量越大（0.4） |
| s_spo2 | 血氧 | 越低越差（0.1） |
| s_resp | 呼吸率 | 越高越紧张（0.1） |

结合活动量区分「运动中高心率」与「静息压力」：

- `active`：窗口内 activeSeconds≥300 或 steps≥300 → 活跃/运动
- `stressed`：静息 + stress_index≥0.60 → 压力偏高
- `calm`：静息 + 压力指数低 → 平静
- `unknown`：该窗无有效读数

**注意**：当前 REF 区间与阈值是"演示参数"，来自样例数据 README 的合理范围。拿到真机数据后应重标定（例如把 HRV 参考区间中心对齐到实测中位数），否则基线会偏向"偏紧张"。

## 真机数据接入（重要）

- App 历史同步导出的 CSV 与样例格式**完全一致**，把导出文件放到仓库内的 `data/` 下，改脚本里的 `meas_path` / `act_path` 即可复用同一套管线。
- `loader.py` 已做列名容错（大小写、`respRate`/`resprate`），真机导出可直接喂入。

## 后续 A 方案接入点

实时 WebSocket 转发的 JSON 字段与此基线对齐，方便 PC 端复用同一套特征函数：

| SDK Stream | JSON type | 对应 emotion_features 输入 |
| --- | --- | --- |
| spo2ResultStream | spo2 | hr / spo2 / isVerified |
| deviceStatusStream | status | 电量、设备状态 |
| ppgWaveStream | ppg | 原始波形（调试模式再开） |
| accStream | acc | 原始三轴（运动伪影/活动识别） |
| syncHistory | history 事件 | 等价于 CSV 数据，可实时喂入 build_features |
