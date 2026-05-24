##############################################################################
# backfill-original-language.ps1
#
# Remplit original_language (et year si null) dans movie_embeddings
# pour tous les films qui n'ont pas encore ces données.
#
# Utilisation :
#   .\scripts\backfill-original-language.ps1 -ServiceRoleKey "eyJ..."
#
# La service role key se trouve dans :
#   Supabase dashboard → Settings → API → service_role (secret)
##############################################################################

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceRoleKey,
    [int]$BatchSize = 200,    # films traités par lot
    [int]$Parallel  = 10,     # appels TMDB simultanés par lot
    [int]$DelayMs   = 80      # pause entre groupes parallèles (ms)
)

$TMDB_KEY     = "2dca580c2a14b55200e784d157207b4d"
$SUPABASE_URL = "https://lrjhpflvkrebbngfnaif.supabase.co"

$headers = @{
    "Authorization" = "Bearer $ServiceRoleKey"
    "apikey"        = $ServiceRoleKey
    "Content-Type"  = "application/json"
    "Prefer"        = "return=minimal"
}

# ── 1. Récupérer tous les films sans original_language ──────────────────────
Write-Host "Récupération des films sans original_language..." -ForegroundColor Cyan

$allFilms = @()
$offset   = 0
$pageSize = 1000

do {
    $url  = "$SUPABASE_URL/rest/v1/movie_embeddings?select=tmdb_id,media_type,year&original_language=is.null&order=tmdb_id.asc&limit=$pageSize&offset=$offset"
    $page = Invoke-RestMethod $url -Headers $headers -ErrorAction Stop
    $allFilms += $page
    $offset   += $pageSize
    Write-Host "  $($allFilms.Count) films récupérés..."
} while ($page.Count -eq $pageSize)

Write-Host "$($allFilms.Count) films à mettre à jour." -ForegroundColor Yellow

if ($allFilms.Count -eq 0) {
    Write-Host "Rien à faire !" -ForegroundColor Green
    exit 0
}

# ── 2. Traitement par lot ────────────────────────────────────────────────────
$updated = 0
$errors  = 0

for ($i = 0; $i -lt $allFilms.Count; $i += $BatchSize) {
    $batch = $allFilms[$i..([Math]::Min($i + $BatchSize - 1, $allFilms.Count - 1))]
    Write-Host "Lot $([Math]::Floor($i/$BatchSize)+1) — films $($i+1)-$([Math]::Min($i+$BatchSize,$allFilms.Count))/$($allFilms.Count)" -ForegroundColor Cyan

    # Traitement parallèle par groupe de $Parallel
    for ($j = 0; $j -lt $batch.Count; $j += $Parallel) {
        $group = $batch[$j..([Math]::Min($j + $Parallel - 1, $batch.Count - 1))]

        $jobs = $group | ForEach-Object {
            $film = $_
            [PSCustomObject]@{
                Film   = $film
                Result = $null
                Error  = $null
            }
        }

        # Appels TMDB séquentiels rapides dans le groupe
        foreach ($job in $jobs) {
            $film     = $job.Film
            $type     = if ($film.media_type -eq "tv") { "tv" } else { "movie" }
            $tmdbUrl  = "https://api.themoviedb.org/3/$type/$($film.tmdb_id)?api_key=$TMDB_KEY"
            try {
                $detail = Invoke-RestMethod $tmdbUrl -ErrorAction SilentlyContinue
                $job.Result = $detail
            } catch {
                $job.Error = $_.ToString()
            }
            Start-Sleep -Milliseconds $DelayMs
        }

        # Mise à jour Supabase pour chaque film du groupe
        foreach ($job in $jobs) {
            if ($job.Error -or $null -eq $job.Result) {
                $errors++
                continue
            }

            $detail = $job.Result
            $film   = $job.Film

            $origLang = $detail.original_language
            if (-not $origLang) { $errors++; continue }

            # Calcule year si absent
            $yearVal = $film.year
            if (-not $yearVal) {
                $dateStr = if ($film.media_type -eq "tv") { $detail.first_air_date } else { $detail.release_date }
                if ($dateStr -and $dateStr.Length -ge 4) {
                    $yearVal = [int]$dateStr.Substring(0, 4)
                }
            }

            $body = @{ original_language = $origLang }
            if ($yearVal) { $body.year = [int]$yearVal }

            $patchUrl = "$SUPABASE_URL/rest/v1/movie_embeddings?tmdb_id=eq.$($film.tmdb_id)"
            try {
                Invoke-RestMethod $patchUrl -Method PATCH -Headers $headers `
                    -Body ($body | ConvertTo-Json -Compress) -ErrorAction Stop | Out-Null
                $updated++
            } catch {
                Write-Host "  PATCH erreur tmdb_id=$($film.tmdb_id): $_" -ForegroundColor Red
                $errors++
            }
        }

        Write-Host "  $updated mis à jour, $errors erreurs"
    }

    # Pause entre lots pour ne pas saturer TMDB
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Terminé : $updated mis à jour, $errors erreurs." -ForegroundColor Green
