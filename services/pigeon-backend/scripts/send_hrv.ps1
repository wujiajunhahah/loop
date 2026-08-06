param(
    [string]$BaseUrl = "http://127.0.0.1:8010",
    [string]$DeviceId = "alloop-demo-001",
    [string]$DeviceToken = "change-this-device-token",
    [double]$Value = 50,
    [double]$Quality = 0.95
)

$Body = @{
    reading_id = "reading-$([guid]::NewGuid().ToString('N'))"
    device_id = $DeviceId
    measured_at = [DateTime]::UtcNow.ToString("o")
    value = $Value
    quality = $Quality
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/api/v1/hrv/readings" `
    -Headers @{ "X-Device-Token" = $DeviceToken } `
    -ContentType "application/json" `
    -Body $Body
