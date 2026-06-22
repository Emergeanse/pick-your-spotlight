# Smoke test Pick — build + unit + E2E (subset)
# Usage : .\scripts\smoke-test.ps1 [-Full]
#
# -Full : inclut pipeline, cinema, soirees, reveal (nécessite E2E_TEST_EMAIL)

param(
    [switch]$Full
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Charger .env.test si présent (E2E credentials)
$envTest = Join-Path $root ".env.test"
if (Test-Path $envTest) {
    Get-Content $envTest | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            Set-Item -Path "env:$name" -Value $value
        }
    }
    Write-Host "[smoke] Variables chargées depuis .env.test" -ForegroundColor Cyan
} else {
    Write-Host "[smoke] Pas de .env.test — E2E authentifiés seront skippés" -ForegroundColor Yellow
}

Write-Host "`n=== 1/3 Build ===" -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== 2/3 Unit (event-reveal) ===" -ForegroundColor Green
npx vitest run src/test/event-reveal.test.ts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== 3/3 E2E Playwright ===" -ForegroundColor Green
if ($Full) {
    if (-not $env:E2E_TEST_EMAIL) {
        Write-Host "[smoke] ATTENTION : -Full sans E2E_TEST_EMAIL — plusieurs tests seront skippés" -ForegroundColor Yellow
    }
    npx playwright test
} else {
    npx playwright test auth.spec.ts navigation.spec.ts pipeline.spec.ts reveal.spec.ts
}
exit $LASTEXITCODE
