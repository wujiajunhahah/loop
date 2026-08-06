param(
    [string]$BaseUrl = "http://127.0.0.1:8010",
    [Parameter(Mandatory = $true)]
    [string]$Text
)

$RequestId = "request-$([guid]::NewGuid().ToString('N'))"
$Body = @{
    client_request_id = $RequestId
    relationship_id = "rel_linlan_linya_001"
    recipient_id = "person_linya"
    device_id = "alloop-demo-001"
    input = @{ type = "text"; text = $Text }
    preferences = @{ content_intensity = "L1" }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/api/v1/interactions" `
    -Headers @{ "Idempotency-Key" = $RequestId } `
    -ContentType "application/json" `
    -Body $Body
