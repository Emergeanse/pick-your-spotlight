##############################################################################
# backfill-original-language.ps1
#
# Remplit original_language (et year si null) dans movie_embeddings
# pour tous les films existants, via TMDB API + RPC Supabase.
#
# Utilisation :
#   .\scripts\backfill-original-language.ps1
#   .\scripts\backfill-original-language.ps1 -BatchSize 200
##############################################################################

param(
    [int]$BatchSize = 150,   # films traités par tour
    [int]$DelayMs   = 80     # pause entre appels TMDB (ms)
)

$TMDB_KEY = $env:TMDB_API_KEY
if (-not $TMDB_KEY) { throw "TMDB_API_KEY doit être défini dans l'environnement" }
$SUPABASE_URL = "https://lrjhpflvkrebbngfnaif.supabase.co"
$ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk"

$readHeaders = @{
    "Authorization" = "Bearer $ANON_KEY"
    "apikey"        = $ANON_KEY
    "Content-Type"  = "application/json"
}

function Invoke-Tmdb($tmdbId, $mediaType) {
    $type = if ($mediaType -eq "tv") { "tv" } else { "movie" }
    try {
        return Invoke-RestMethod "https://api.themoviedb.org/3/$type/${tmdbId}?api_key=$TMDB_KEY" -ErrorAction SilentlyContinue
    } catch { return $null }
}

function Update-MovieLanguage($tmdbId, $origLang, $year) {
    $body = @{ p_tmdb_id = [int]$tmdbId; p_original_language = $origLang }
    if ($year) { $body.p_year = [int]$year }
    try {
        Invoke-RestMethod "$SUPABASE_URL/rest/v1/rpc/update_movie_language" `
            -Method POST -Headers $readHeaders `
            -Body ($body | ConvertTo-Json -Compress) -ErrorAction Stop | Out-Null
        return $true
    } catch {
        Write-Host "  RPC erreur tmdb_id=$tmdbId : $_" -ForegroundColor Red
        return $false
    }
}

$totalUpdated = 0
$totalErrors  = 0
$round        = 0

Write-Host "Démarrage du backfill original_language..." -ForegroundColor Cyan

do {
    $round++

    # Récupère le prochain batch via RPC SECURITY DEFINER (contourne RLS anon)
    $films = @()
    try {
        $films = Invoke-RestMethod "$SUPABASE_URL/rest/v1/rpc/get_movies_needing_language" `
            -Method POST -Headers $readHeaders `
            -Body (@{ p_limit = $BatchSize } | ConvertTo-Json -Compress) -ErrorAction Stop
    } catch {
        Write-Host "Erreur lecture Supabase : $_" -ForegroundColor Red
        break
    }

    if ($films.Count -eq 0) {
        Write-Host "`nBackfill terminé ! $totalUpdated films mis à jour, $totalErrors erreurs." -ForegroundColor Green
        break
    }

    $batchUpdated = 0
    $batchErrors  = 0

    foreach ($film in $films) {
        $detail = Invoke-Tmdb -tmdbId $film.tmdb_id -mediaType $film.media_type
        if (-not $detail -or -not $detail.original_language) {
            $batchErrors++
            Start-Sleep -Milliseconds $DelayMs
            continue
        }

        $yearVal = $film.year
        if (-not $yearVal) {
            $dateStr = if ($film.media_type -eq "tv") { $detail.first_air_date } else { $detail.release_date }
            if ($dateStr -and $dateStr.Length -ge 4) { $yearVal = [int]$dateStr.Substring(0, 4) }
        }

        $ok = Update-MovieLanguage -tmdbId $film.tmdb_id -origLang $detail.original_language -year $yearVal
        if ($ok) { $batchUpdated++ } else { $batchErrors++ }

        Start-Sleep -Milliseconds $DelayMs
    }

    $totalUpdated += $batchUpdated
    $totalErrors  += $batchErrors

    $color = if ($batchErrors -gt 0) { "Yellow" } else { "Green" }
    Write-Host "Tour $round - traites: $($films.Count) | maj: $batchUpdated | erreurs: $batchErrors | total: $totalUpdated" -ForegroundColor $color

} while ($true)
