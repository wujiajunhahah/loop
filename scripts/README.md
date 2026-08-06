# Maintenance scripts / 维护脚本

Small, optional helpers live here so that the repository root stays focused on runnable entry points.

这里保存小型、可选的维护工具，让仓库根目录只保留主要运行入口。

## Windows

[`windows/fix-java.ps1`](./windows/fix-java.ps1) replaces `VERSION_21` with `VERSION_17` in an explicitly supplied Gradle build file:

```powershell
.\scripts\windows\fix-java.ps1 -BuildFile .\path\to\build.gradle.kts
```

The script fails without changing the file when the target does not contain `VERSION_21`.
