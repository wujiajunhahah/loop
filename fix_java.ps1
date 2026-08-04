(Get-Content 'E:\omi-firmware\app\android\app\build.gradle' -Raw) -replace 'VERSION_21', 'VERSION_17' | Set-Content 'E:\omi-firmware\app\android\app\build.gradle' -NoNewline
Write-Host 'Done'