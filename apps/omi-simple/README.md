# Omi voice-diary client / Omi 语音日记客户端

This Flutter client connects to an Omi wearable over BLE, subscribes to its audio, battery, and button characteristics, and forwards received Opus bytes to the Wozai messenger backend in five-second chunks.

该 Flutter 客户端通过 BLE 连接 Omi 可穿戴设备，订阅音频、电量和按钮特征值，并将收到的 Opus 数据按五秒分块发送到「我在」信鸽后端。

## Data path / 数据链路

```text
Omi wearable
  → BLE audio notifications
  → local five-second buffer
  → POST /api/conversation/voice-diary
  → services/pigeon-backend
```

Each request includes a session ID, audio format, timestamp, and `X-Source: omi_simple`. The backend records the original bytes and receipt metadata; this client does not infer emotion from audio.

## Run / 运行

Start the [`pigeon-backend`](../../services/pigeon-backend/README.md), connect an Android physical device with Bluetooth enabled, then run:

```bash
cd apps/omi-simple
flutter pub get
flutter run \
  --dart-define=VOICE_DIARY_URL=http://<computer-lan-ip>:8010/api/conversation/voice-diary
```

The phone and backend computer must be reachable on the same network. Grant Bluetooth scan/connect and location permissions when Android requests them.

## Source map / 源码导航

| File | Responsibility |
| --- | --- |
| [`lib/omi_ble_service.dart`](./lib/omi_ble_service.dart) | Scan, connect, discover Omi services, and subscribe to audio/battery/button events |
| [`lib/voice_forwarder.dart`](./lib/voice_forwarder.dart) | Buffer audio and send five-second HTTP chunks |
| [`lib/ui/home_page.dart`](./lib/ui/home_page.dart) | Device list, connection state, battery, and received-byte UI |

Do not place private recordings, device tokens, or real family memories in public Issues or test fixtures.
