# Software MVP

The Software MVP is the repository’s Vite/React and Capacitor application. It contains the Relationship Agent foundation, creator and recipient flows, permission boundaries, Omi/ring device contracts, simulators, and the native iOS shell.

Software MVP 是仓库中的 Vite/React 与 Capacitor 应用，包含 Relationship Agent 基础能力、记录者与接收者流程、权限边界、Omi / 戒指设备契约、模拟器以及 iOS 原生外壳。

## Run locally / 本地运行

```bash
cd apps/software-mvp
npm install
npm run dev
```

## Verify / 验证

```bash
npm run build
npm test
```

Optional physical-device values are documented in [`.env.example`](./.env.example). The high-fidelity Hackathon presentation flow lives separately in [`../visual-prototype/`](../visual-prototype/README.md).
