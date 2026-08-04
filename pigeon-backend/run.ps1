param(
    [int]$Port = 8010,
    [string]$BindAddress = "0.0.0.0"
)

$BackendRoot = $PSScriptRoot
$PythonPath = Join-Path $BackendRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $PythonPath)) {
    Write-Error "没有找到后端虚拟环境。请先在 pigeon-backend 目录执行 README 中的安装命令。"
    exit 1
}

Set-Location -LiteralPath $BackendRoot
& $PythonPath -m uvicorn app.main:app --host $BindAddress --port $Port
