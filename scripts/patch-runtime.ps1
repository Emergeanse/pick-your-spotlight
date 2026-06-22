param(
    [int]$BatchSize = 200,
    [string]$MediaType = "movie"   # "movie" ou "tv" ou "both"
)

$TMDB_KEY = $env:TMDB_API_KEY
if (-not $TMDB_KEY) { throw "TMDB_API_KEY doit être défini dans l'environnement" }
$SUPABASE_URL  = "https://lrjhpflvkrebbngfnaif.supabase.co"
$ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk"

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "apikey"        = $ANON_KEY
    "Content-Type"  = "application/json"
}

Write-Host "=== patch-runtime.ps1 — médiatype: $MediaType, batch: $BatchSize ===" -ForegroundColor Cyan

# ── 1. Récupérer les films avec runtime NULL dans movie_embeddings ──────────
$filter = "runtime=is.null&select=tmdb_id,title,media_type&limit=$BatchSize"
if ($MediaType -ne "both") { $filter = "media_type=eq.$MediaType&$filter" }

$rows = @()
try {
    $rows = Invoke-RestMethod "$SUPABASE_URL/rest/v1/movie_embeddings?$filter" `
        -Headers $headers
} catch {
    Write-Host "Erreur lecture Supabase: $_" -ForegroundColor Red
    exit 1
}

Write-Host "$($rows.Count) films avec runtime NULL trouvés" -ForegroundColor Yellow

$ok = 0; $errors = 0; $skipped = 0

foreach ($row in $rows) {
    $id   = $row.tmdb_id
    $type = $row.media_type
    if (-not $type) { $type = "movie" }

    # ── 2. Récupérer les détails TMDB ───────────────────────────────────────
    try {
        $detail = Invoke-RestMethod "https://api.themoviedb.org/3/$type/${id}?api_key=$TMDB_KEY&language=fr-FR" `
            -ErrorAction SilentlyContinue
    } catch {
        $errors++
        Write-Host "  TMDB erreur id=$id : $_" -ForegroundColor DarkRed
        Start-Sleep -Milliseconds 200
        continue
    }

    if (-not $detail) { $skipped++; continue }

    $runtime     = if ($detail.runtime)      { [int]$detail.runtime }      else { $null }
    $year        = if ($detail.release_date) { [int]($detail.release_date.Substring(0,4)) } `
                   elseif ($detail.first_air_date) { [int]($detail.first_air_date.Substring(0,4)) } `
                   else { $null }
    $voteAverage = if ($detail.vote_average) { [double]$detail.vote_average } else { $null }
    $popularity  = if ($detail.popularity)   { [double]$detail.popularity }  else { $null }
    $title       = if ($detail.title)        { $detail.title } `
                   elseif ($detail.name)     { $detail.name }  else { $row.title }
    $overview    = $detail.overview
    $genreIds    = @($detail.genres | ForEach-Object { $_.id })

    if (-not $runtime -and $type -eq "movie") {
        $skipped++
        Write-Host "  id=$id '$title' — pas de runtime dans TMDB, ignoré" -ForegroundColor DarkGray
        Start-Sleep -Milliseconds 80
        continue
    }

    # ── 3. Appeler generate-embedding (patche les métadonnées sans relancer l'IA) ──
    $body = @{
        tmdbId      = [int]$id
        title       = $title
        overview    = $overview
        genres      = @($genreIds)
        mediaType   = $type
        year        = $year
        runtime     = $runtime
        voteAverage = $voteAverage
        popularity  = $popularity
    } | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod "$SUPABASE_URL/functions/v1/generate-embedding" `
            -Method POST `
            -Headers $headers `
            -Body $body `
            -ErrorAction SilentlyContinue | Out-Null
        $ok++
        Write-Host "  ✓ id=$id '$title' runtime=${runtime}min" -ForegroundColor Green
    } catch {
        $errors++
        Write-Host "  ✗ id=$id '$title' erreur embedding: $_" -ForegroundColor Red
    }

    Start-Sleep -Milliseconds 150
}

Write-Host ""
Write-Host "=== Terminé : $ok mis à jour / $skipped ignorés / $errors erreurs ===" -ForegroundColor Cyan
