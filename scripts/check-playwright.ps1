# Diagnostic Playwright - verrous, revisions, navigateurs installes
# Usage : .\scripts\check-playwright.ps1 [-FixJunction]
#
# -FixJunction : si un dossier chromium*_shell attendu est vide mais une revision
#               plus recente est installee, cree une jonction NTFS (voir SMOKE_TESTS.md).
# Toujours installer depuis la racine du projet :
#   npx playwright install chromium
# (pas un `playwright install` global - risque de mismatch 1208 vs 1228)

param(
    [switch]$FixJunction
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-BrowserFolderComplete {
    param(
        [string]$FolderPath,
        [string]$FolderName
    )

    if (-not (Test-Path $FolderPath)) { return $false }

    $topLevel = Get-ChildItem $FolderPath -Force -ErrorAction SilentlyContinue
    if (-not $topLevel -or $topLevel.Count -eq 0) { return $false }

    if ($FolderName -like "chromium_headless_shell-*") {
        $exe = Get-ChildItem -Path $FolderPath -Recurse -Filter "chrome-headless-shell.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        return $null -ne $exe
    }

    if ($FolderName -like "chromium-*") {
        $exe = Get-ChildItem -Path $FolderPath -Recurse -Filter "chrome.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        return $null -ne $exe
    }

    return $true
}

function Get-ExpectedPlaywrightRevisions {
    $browsersJson = Join-Path $root "node_modules\playwright-core\browsers.json"
    if (-not (Test-Path $browsersJson)) {
        return $null
    }

    $data = Get-Content $browsersJson -Raw | ConvertFrom-Json
    $chromium = $data.browsers | Where-Object { $_.name -eq "chromium" } | Select-Object -First 1
    $shell = $data.browsers | Where-Object { $_.name -eq "chromium-headless-shell" } | Select-Object -First 1

    $pwPkg = Join-Path $root "node_modules\@playwright\test\package.json"
    $pwVersion = if (Test-Path $pwPkg) {
        (Get-Content $pwPkg -Raw | ConvertFrom-Json).version
    } else {
        "?"
    }

    return @{
        Version          = $pwVersion
        ChromiumRevision = $chromium.revision
        ShellRevision    = $shell.revision
    }
}

function Get-BrowserFolderRevision {
    param([string]$FolderName)

    if ($FolderName -match '^chromium_headless_shell-(\d+)$') { return $Matches[1] }
    if ($FolderName -match '^chromium-(\d+)$') { return $Matches[1] }
    return $null
}

function Invoke-JunctionFix {
    param(
        [string]$PlaywrightDir,
        [string]$Prefix,
        [string]$ExpectedRevision,
        [bool]$Apply
    )

    $expectedName = "${Prefix}-${ExpectedRevision}"
    $expectedPath = Join-Path $PlaywrightDir $expectedName
    $expectedComplete = Test-BrowserFolderComplete $expectedPath $expectedName

    if ($expectedComplete) { return $false }

    $candidates = Get-ChildItem $PlaywrightDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "${Prefix}-*" } |
        ForEach-Object {
            $rev = Get-BrowserFolderRevision $_.Name
            if ($rev -and [int]$rev -gt [int]$ExpectedRevision -and (Test-BrowserFolderComplete $_.FullName $_.Name)) {
                [PSCustomObject]@{ Name = $_.Name; Path = $_.FullName; Revision = [int]$rev }
            }
        } |
        Sort-Object Revision -Descending

    if (-not $candidates) { return $false }

    $source = $candidates[0]
    Write-Host "  [junction] $expectedName vide/incomplet - source candidate : $($source.Name)" -ForegroundColor Yellow

    if (-not $Apply) {
        Write-Host "  [junction] Suggestion : .\scripts\check-playwright.ps1 -FixJunction" -ForegroundColor Yellow
        Write-Host "  [junction] Ou preferable : npx playwright install chromium (depuis la racine du projet)" -ForegroundColor Yellow
        return $true
    }

    if (Test-Path $expectedPath) {
        Remove-Item $expectedPath -Recurse -Force
    }

    New-Item -ItemType Junction -Path $expectedPath -Target $source.Path | Out-Null
    Write-Host "  [junction] Cree : $expectedName -> $($source.Name)" -ForegroundColor Green
    return $false
}

Write-Host "`n=== Diagnostic Playwright ===" -ForegroundColor Green
Write-Host "Projet : $root"

$expected = Get-ExpectedPlaywrightRevisions
if (-not $expected) {
    Write-Host "[ERREUR] node_modules/playwright-core introuvable - lancer npm ci" -ForegroundColor Red
    Write-Host "[READY] E2E pret : NON"
    exit 1
}

Write-Host "`n--- Version projet ---" -ForegroundColor Cyan
Write-Host "@playwright/test : $($expected.Version)"
Write-Host "Revision chromium attendue : $($expected.ChromiumRevision)"
Write-Host "Revision headless shell attendue : $($expected.ShellRevision)"

$playwrightDir = Join-Path $env:LOCALAPPDATA "ms-playwright"
Write-Host "`n--- Dossier navigateurs ---" -ForegroundColor Cyan
Write-Host $playwrightDir

$ready = $true
$junctionSuggested = $false

Write-Host "`n--- Verrous (__dirlock) ---" -ForegroundColor Cyan
if (-not (Test-Path $playwrightDir)) {
    Write-Host "  (dossier absent)" -ForegroundColor Yellow
    $ready = $false
} else {
    $locks = Get-ChildItem $playwrightDir -Recurse -Filter "__dirlock" -Force -ErrorAction SilentlyContinue
    if ($locks) {
        foreach ($lock in $locks) {
            Write-Host "  BLOQUE : $($lock.FullName)" -ForegroundColor Red
        }
        Write-Host "  -> Attendre la fin de l'install ou supprimer le verrou si processus mort" -ForegroundColor Yellow
        $ready = $false
    } else {
        Write-Host "  Aucun verrou" -ForegroundColor Green
    }
}

Write-Host "`n--- Processus install en cours ---" -ForegroundColor Cyan
$installProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'playwright.*install' }
if ($installProcs) {
    foreach ($proc in $installProcs) {
        Write-Host "  EN COURS (PID $($proc.ProcessId))" -ForegroundColor Yellow
    }
    $ready = $false
} else {
    Write-Host "  Aucun" -ForegroundColor Green
}

Write-Host "`n--- Dossiers installes ---" -ForegroundColor Cyan
$installedFolders = @()
if (Test-Path $playwrightDir) {
    $installedFolders = Get-ChildItem $playwrightDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "chromium-*" -or $_.Name -like "chromium_headless_shell-*" }
}

if (-not $installedFolders -or $installedFolders.Count -eq 0) {
    Write-Host "  Aucun dossier chromium* trouve" -ForegroundColor Red
    $ready = $false
} else {
    foreach ($folder in ($installedFolders | Sort-Object Name)) {
        $rev = Get-BrowserFolderRevision $folder.Name
        $complete = Test-BrowserFolderComplete $folder.FullName $folder.Name
        $status = if ($complete) { "OK" } else { "INCOMPLET" }
        $color = if ($complete) { "Green" } else { "Red" }
        $revNote = if ($rev) { " (rev. $rev)" } else { "" }
        Write-Host "  $($folder.Name)$revNote : $status" -ForegroundColor $color
        if (-not $complete) { $ready = $false }
    }
}

Write-Host "`n--- Alignement revisions ---" -ForegroundColor Cyan
$checks = @(
    @{ Prefix = "chromium"; Expected = $expected.ChromiumRevision },
    @{ Prefix = "chromium_headless_shell"; Expected = $expected.ShellRevision }
)

foreach ($check in $checks) {
    $expectedFolder = "$($check.Prefix)-$($check.Expected)"
    $expectedPath = Join-Path $playwrightDir $expectedFolder
    $complete = Test-BrowserFolderComplete $expectedPath $expectedFolder

    if ($complete) {
        Write-Host "  $expectedFolder : OK (attendu par le projet)" -ForegroundColor Green
        continue
    }

    $newer = Get-ChildItem $playwrightDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "$($check.Prefix)-*" } |
        ForEach-Object {
            $rev = Get-BrowserFolderRevision $_.Name
            if ($rev -and [int]$rev -ne [int]$check.Expected -and (Test-BrowserFolderComplete $_.FullName $_.Name)) {
                [PSCustomObject]@{ Name = $_.Name; Revision = [int]$rev }
            }
        } |
        Sort-Object Revision -Descending |
        Select-Object -First 1

    if ($newer) {
        Write-Host "  $expectedFolder : MANQUANT/INCOMPLET - mais $($newer.Name) present (MISMATCH)" -ForegroundColor Red
        Write-Host "    -> Symptome typique : install global vs @playwright/test du projet" -ForegroundColor Yellow
        Write-Host "    -> Fix : npx playwright install chromium (depuis la racine du projet)" -ForegroundColor Yellow
        $ready = $false
    } else {
        Write-Host "  $expectedFolder : MANQUANT" -ForegroundColor Red
        Write-Host "    -> npx playwright install chromium" -ForegroundColor Yellow
        $ready = $false
    }
}

if ($FixJunction -or -not $ready) {
    Write-Host "`n--- Jonctions (workaround) ---" -ForegroundColor Cyan
    if (-not (Test-Path $playwrightDir)) {
        Write-Host "  (dossier navigateurs absent)" -ForegroundColor Yellow
    } else {
        foreach ($check in $checks) {
            $suggested = Invoke-JunctionFix -PlaywrightDir $playwrightDir -Prefix $check.Prefix `
                -ExpectedRevision $check.Expected -Apply:$FixJunction
            if ($suggested) { $junctionSuggested = $true }
        }
        if ($FixJunction) {
            $ready = $true
            foreach ($check in $checks) {
                $expectedFolder = "$($check.Prefix)-$($check.Expected)"
                $expectedPath = Join-Path $playwrightDir $expectedFolder
                if (-not (Test-BrowserFolderComplete $expectedPath $expectedFolder)) {
                    $ready = $false
                }
            }
            $locks = Get-ChildItem $playwrightDir -Recurse -Filter "__dirlock" -Force -ErrorAction SilentlyContinue
            if ($locks) { $ready = $false }
            if ($installProcs) { $ready = $false }
        }
    }
}

Write-Host "`n--- Verdict ---" -ForegroundColor Cyan
if ($junctionSuggested -and -not $FixJunction) {
    Write-Host "  Workaround jonction possible (-FixJunction) - preferer npx playwright install chromium" -ForegroundColor Yellow
}
$verdict = if ($ready) { "OUI" } else { "NON" }
$verdictColor = if ($ready) { "Green" } else { "Red" }
Write-Host "[READY] E2E pret : $verdict" -ForegroundColor $verdictColor

exit $(if ($ready) { 0 } else { 1 })
