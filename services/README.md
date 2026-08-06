# Services / 服务

Backend APIs and relay experiments are grouped here.

这里集中保存后端接口与设备转发实验。

| Path | Role | Run |
| --- | --- | --- |
| [`pigeon-backend/`](./pigeon-backend/README.md) | FastAPI messenger API, grounded evidence, HRV presentation policy, feedback, and outcomes | Uvicorn on port `8010` |
| [`local-relay/`](./local-relay/README.md) | Early WebSocket, upload, and browser relay experiment | `npm start` |

The FastAPI service is the maintained Hackathon backend. The local relay remains available for device-path experiments and is documented as a separate service to avoid confusing the two runtimes.
