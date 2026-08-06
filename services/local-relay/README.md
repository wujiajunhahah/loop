# Local relay experiment / 本地转发实验

This small Node.js service supports the early device-to-browser relay path. It runs a WebSocket endpoint on port `8080` and an HTTP server on port `3000` for the browser page, audio uploads, and memory events.

这是早期设备到浏览器链路使用的轻量 Node.js 服务：WebSocket 使用 `8080` 端口，网页、音频上传和记忆事件接口使用 `3000` 端口。

```bash
cd services/local-relay
npm install
npm start
```

Then open <http://localhost:3000>. Uploaded files are written to `services/local-relay/uploads/` and should not contain sensitive personal material.

The Hackathon messenger API is maintained separately in [`pigeon-backend/`](../pigeon-backend/README.md).
