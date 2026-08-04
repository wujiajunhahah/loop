# Alloop HRV 与信鸽回信联调说明

## 已修复的断点

原来的 `/api/conversation/voice-diary` 只接收音频字节，不能从音频中得到 Alloop 戒指计算的 HRV。后端虽然已有 `POST /api/v1/hrv/readings`，但正式 Alloop 客户端没有调用它，所以发信时只能回退到标准节奏。

现在的数据链路是：

```text
Alloop 戒指
→ app/ 内的官方 alloop_blue_lite SDK
→ syncHistory(deviceId)
→ 最新一条有效 MeasurementRecord.hrv
→ POST /api/v1/hrv/readings
→ 后端按 15 分钟有效期读取
→ POST /api/v1/interactions
→ presentation.mode 随 HRV 档位改变
→ 前端显示本次采用的呈现节奏
```

HRV 只调节内容强度和节奏，不用于医学诊断，也不用于断言用户开心、悲伤或焦虑。

## 主机配置

当前电脑的 WLAN 地址是：

```text
192.168.252.151
```

正式 Alloop 客户端的配置文件是：

```text
app/.env
```

内容应为：

```dotenv
PIGEON_HRV_URL=http://192.168.252.151:8010/api/v1/hrv/readings
PIGEON_HRV_DEVICE_ID=alloop-demo-001
PIGEON_HRV_DEVICE_TOKEN=change-this-device-token
```

电脑网络改变后，如果 WLAN 地址变化，只修改 `PIGEON_HRV_URL` 中的 IP，然后重新构建/运行 Flutter App。`PIGEON_HRV_DEVICE_TOKEN` 必须与 `pigeon-backend/.env` 的 `ALLOOP_DEVICE_TOKENS` 保持一致。

## 实际戒指联调步骤

1. 在 `pigeon-backend/` 运行 `run.cmd`，后端必须监听 `0.0.0.0:8010`。
2. 确保 Android 手机和电脑连接可互访的同一网络。
3. 在 `app/` 执行 `flutter pub get`，再将 App 运行到 Android 手机。
4. 在 Alloop App 中扫描并连接戒指。
5. 进入 History Sync Debug，执行历史数据同步。
6. App 会从 `measurement` 记录中选择时间最新、`hrv > 0` 且 `hrSuccess=true` 的一条记录上传；成功时提示 `Latest HRV ... sent to Pigeon backend`。
7. 打开女儿端页面。HRV 卡片会显示以下三种状态之一：
   - 尚未收到：客户端还没有成功上传；
   - 已收到但过期：记录存在，但本次回信不会使用；
   - 已收到且新鲜：显示 HRV 数值以及轻缓、标准或开放探索节奏。

前端每 5 秒读取一次：

```text
GET /api/v1/hrv/latest?device_id=alloop-demo-001
```

后端日志中应看到：

```text
HRV_RECEIVED device_id=alloop-demo-001 ... value=... state=... valid=True
```

## MVP 分档

固定基线为 50：

- HRV < 42.5：`gentle`，减少动效，不主动引导深入；
- 42.5 ≤ HRV ≤ 57.5：`standard`；
- HRV > 57.5：`standard_open`，允许用户继续查看原始记录；
- 缺失、无效或过期：安全回退为 `standard`。

Alloop SDK 中 `hrv=0` 代表没有有效读数，因此不会上传。客户端每次同步只上传最新有效记录，不会把全部历史 CSV 逐条发送。

## 当前网址

- 前端本机：<http://127.0.0.1:5174/>
- 前端局域网：<http://192.168.252.151:5174/>
- 接口文档：<http://127.0.0.1:8010/docs>
- HRV 状态：<http://127.0.0.1:8010/api/v1/hrv/latest?device_id=alloop-demo-001>

注意：`app/` 是正式需要构建的 Alloop 客户端；`alloop-hackathon-reference/` 仅用于核对官方 SDK 文档，不要从参考目录运行交付版本。
