# ASCII-only (Arabic breaks older PowerShell parsers when file encoding mismatches).
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root.Path

$key = "VITE_AUTOMATION_RSA_PUBLIC_PEM_B64"
$file = Join-Path $root "secrets\PASTE_IN_VERCEL_VITE_AUTOMATION_RSA_PUBLIC_PEM_B64.txt"
if (-not (Test-Path -LiteralPath $file)) {
    Write-Host "Missing file (run npm run automation:setup first):" $file -ForegroundColor Red
    exit 1
}

$envName = if ($args[0]) { $args[0] } else { "production" }
Write-Host "Uploading $key to Vercel [$envName]..." -ForegroundColor Cyan
Get-Content -LiteralPath $file -Raw | npx vercel env add $key $envName --yes --force
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Done." -ForegroundColor Green
