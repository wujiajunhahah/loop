# 接收视角“远行信使”后端 MVP

这是一个与前端分离的 FastAPI 后端。前端只需按照稳定的 HTTP 契约提交文字、展示返回结果并提交主观反馈；页面组件、路由和视觉样式可以独立迭代。当前原型中，它同时服务于记录者的“未来接收视角预览”和 Hackathon 的状态敏感呈现 Demo。

当前固定设定：林岚—林崖母女；唯一已核对原文为：

> 一次没做好，不等于你不行。今晚先睡，明天再说。

模型只负责判断这条原文与接收视角输入的关系，并编排中性的“信使/系统叙述”。后端校验器会拒绝改写原文、伪造林岚表态或把 HRV 解释成情绪。

## 安装与启动

在仓库根目录进入本模块：

```bash
cd services/pigeon-backend
```

Windows PowerShell 首次安装与启动：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

如果安装结束时看到下面这种内容：

```text
[notice] A new release of pip is available
```

它只是版本升级提醒，不是报错，不影响后端运行。只要前面出现 `Successfully installed` 就表示安装成功，可以直接继续启动。若希望升级 pip，可选执行：

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

```powershell
.\run.cmd
```

macOS / Linux 首次安装与启动：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

启动后，当前终端窗口会持续被服务占用，这是正常现象；不要关闭这个窗口。后端不会自动打开浏览器，也不会让 `http://127.0.0.1:5173` 的前端页面自行发生变化。请手动访问 `http://127.0.0.1:8010/docs` 查看和测试接口。如需执行 HRV 或发信演示命令，请另开一个终端窗口。

如果看到 `[Errno 10048]`，表示 8010 已经被一个服务占用。若健康检查仍能打开，通常只是后端已经启动，不需要重复执行 `run.cmd`。新版 `run.cmd` 会先检查健康接口，并在服务已运行时直接给出提示。

本机接口文档：<http://127.0.0.1:8010/docs>
健康检查：<http://127.0.0.1:8010/health>
集成前端：<http://127.0.0.1:5174/>

本机的 8000 端口已有其他 Uvicorn 服务，因此本项目默认使用 8010。若 8010 也被占用，可直接执行 `.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8020`，并同步修改前端和设备使用的端口。

仓库也包含 `run.ps1`，但部分 Windows 电脑会因 PowerShell 执行策略阻止 `.ps1`；`run.cmd` 不要求修改系统策略。

## API 密钥

在本目录的 `.env` 中填写：

```dotenv
OPENAI_API_KEY=你的密钥
OPENAI_MODEL=gpt-5.6-terra
MODEL_MODE=auto
```

未填写密钥时，`auto` 会自动使用确定性的本地演示模型，便于先验证完整链路。填写后重启服务，健康检查中的 `model_mode` 应变为 `openai`。`.env` 已被 Git 忽略。

## Alloop HRV 上报

设备向下面的接口发送 HTTP POST：

```text
POST http://<运行后端的电脑局域网IP>:8010/api/v1/hrv/readings
X-Device-Token: change-this-device-token
Content-Type: application/json
```

```json
{
  "reading_id": "reading-0001",
  "device_id": "alloop-demo-001",
  "measured_at": "2026-08-04T08:00:00Z",
  "value": 50,
  "quality": 0.95
}
```

演示脚本：

```powershell
.\.venv\Scripts\python.exe .\scripts\send_hrv.py --value 40
.\.venv\Scripts\python.exe .\scripts\send_hrv.py --value 50
.\.venv\Scripts\python.exe .\scripts\send_hrv.py --value 60
```

固定基线 50 时，默认低于 42.5 为 `low`，42.5～57.5 为 `normal`，高于 57.5 为 `high`。这只是设备综合值的相对分档，不是医学判断：

- `low`：`gentle`，短文案、减弱动效、不引导深入；
- `normal`：`standard`；
- `high`：`standard_open`，可显示“以后查看原始记录”的入口；
- 缺失、过期或质量不足：按 `standard`，不猜测用户状态。

生产演示前应在 `.env` 中替换 `ALLOOP_DEVICE_TOKENS`。主机与戒指必须在可互访的网络中，Windows 防火墙还需允许所选端口的入站 TCP 连接。

## Alloop/Omi 语音日记接收

接口文档中提供以下正式接收接口：

```text
POST /api/conversation/voice-diary
Content-Type: application/octet-stream
X-Session-Id: <本次录音会话ID>
X-Audio-Format: opus
X-Timestamp: <ISO 8601时间>
X-Source: omi_simple
```

它与 [`apps/omi-simple/lib/voice_forwarder.dart`](../../apps/omi-simple/lib/voice_forwarder.dart) 的五秒音频分块协议一致。当前 MVP 会将音频块保存在 `storage/voice-diary/<session_id>/`，并把字节数、格式、时间和校验摘要写入 SQLite；暂不自动转写，也不从声音推断情绪。

本机验收命令：

```powershell
.\.venv\Scripts\python.exe .\scripts\send_voice_diary.py
```

成功时返回 `accepted: true`。运行后端的终端同时会出现：

```text
VOICE_DIARY_RECEIVED method=POST path=/api/conversation/voice-diary ...
POST /api/conversation/voice-diary HTTP/1.1 200 OK
```

无论服务是否在当前可见窗口运行，都可以另开一个 PowerShell 实时查看持久日志：

```powershell
Get-Content .\logs\backend.log -Wait
```

最近接收状态接口为 `GET /api/conversation/voice-diary/recent`，前端女儿主页每五秒读取一次，只展示“已收到、大小、格式、时间”，不会把“已收到”误写成“已完成 AI 处理”。公网部署前请配置 `VOICE_DIARY_DEVICE_TOKEN` 并同步修改设备请求头。

## 前端稳定契约

1. 用户点击发信：`POST /api/v1/interactions`。
2. 前端渲染 `reply`、`evidence` 和 `presentation`，不自行重写回信。
3. 回信实际显示后：`POST /api/v1/interactions/{id}/presented`。
4. 用户点击主观反馈：`POST /api/v1/interactions/{id}/feedback`。
5. 需要查看闭环结果：`GET /api/v1/interactions/{id}/outcome`。

发信示例：

```powershell
.\.venv\Scripts\python.exe .\scripts\demo_interaction.py --text "我最近准备换工作，但很害怕。"
```

反馈代码：`very_relevant`、`not_relevant`、`too_heavy`、`suppress_memory`、`misrepresents_creator`。后三者会分别影响未来强度、隐藏该记忆、或限制为只显示核对后的原文；它们不会改写历史原始内容。

完整请求/响应结构可直接查看启动后的 `/docs`，因此前端组件可以变化，接口版本 `/api/v1` 保持不变。

## 测试

```powershell
.\.venv\Scripts\python.exe -m pytest
```

测试覆盖设备鉴权、HRV 三档、证据原文一致性、无匹配、部分匹配、幂等重试、反馈偏好以及交互前后 HRV 结果。
