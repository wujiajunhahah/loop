param(
    [Parameter(Mandatory = $true)]
    [string]$BuildFile
)

$resolvedBuildFile = (Resolve-Path -LiteralPath $BuildFile).Path
$contents = Get-Content -LiteralPath $resolvedBuildFile -Raw

if (-not $contents.Contains('VERSION_21')) {
    throw "VERSION_21 was not found in $resolvedBuildFile"
}

$contents.Replace('VERSION_21', 'VERSION_17') |
    Set-Content -LiteralPath $resolvedBuildFile -NoNewline

Write-Host "Updated Java compatibility to VERSION_17 in $resolvedBuildFile"
