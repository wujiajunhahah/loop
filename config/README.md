# Reference configuration / 参考配置

This directory groups configuration artifacts that were previously scattered in the repository root. They are retained as integration references and are not imported by the root Vite application.

本目录集中保存原先散落在仓库根目录的配置资料。它们作为设备与应用集成参考保留，不会被根目录 Vite 应用直接导入。

| Path | Purpose |
| --- | --- |
| [`flutter/`](./flutter/) | Generated development and production Flutter environment references |
| [`firebase/`](./firebase/) | FlutterFire option references and Android Google Services configuration |
| [`android-reference/`](./android-reference/) | A preserved standalone Gradle wrapper configuration |

Before copying any reference file into a runnable module, verify its application ID, environment, and credentials for that module. Never commit private keys, service-account files, or production secrets.
