param(
    [int]$MovieStartPage = 1,
    [int]$MovieEndPage   = 0,   # 0 = skip movies
    [int]$TvStartPage    = 1,
    [int]$TvEndPage      = 0,   # 0 = skip TV
    [string]$MovieSort   = "popularity.desc",
    [string]$TvSort      = "popularity.desc",
    [int]$MinVoteCount   = 20,
    [switch]$FetchDetail         # fetch full TMDB detail to get runtime/year
)

$TMDB_KEY = $env:TMDB_API_KEY
if (-not $TMDB_KEY) { throw "TMDB_API_KEY doit être défini dans l'environnement" }
$SUPABASE_URL = "https://lrjhpflvkrebbngfnaif.supabase.co"
$ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk"

$genreMap = @{
    28="Action"; 12="Aventure"; 16="Animation"; 35="Comédie"; 80="Crime"
    99="Documentaire"; 18="Drame"; 10751="Famille"; 14="Fantastique"
    36="Histoire"; 27="Horreur"; 10402="Musique"; 9648="Mystère"
    10749="Romance"; 878="Science-Fiction"; 53="Thriller"; 10752="Guerre"; 37="Western"
    10759="Action & Adventure"; 10762="Kids"; 10763="News"; 10764="Reality"
    10765="Sci-Fi & Fantasy"; 10766="Soap"; 10767="Talk"; 10768="War & Politics"
}

function Seed-Item {
    param($tmdbId, $title, $overview, $genreIds, $mediaType, $year, $runtime, $voteAverage, $popularity)
    $genreNames = @($genreIds | ForEach-Object { if ($genreMap.ContainsKey([int]$_)) { $genreMap[[int]$_] } }) | Where-Object { $_ } | Select-Object -Unique
    $body = @{
        tmdbId      = [int]$tmdbId
        title       = $title
        overview    = $overview
        genres      = $genreNames
        mediaType   = $mediaType
        year        = $year
        runtime     = $runtime
        voteAverage = $voteAverage
        popularity  = $popularity
    } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod "$SUPABASE_URL/functions/v1/generate-embedding" `
            -Method POST `
            -Headers @{ "Authorization" = "Bearer $ANON_KEY"; "Content-Type" = "application/json" } `
            -Body $body `
            -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

function Get-TmdbDetail {
    param($id, $type)
    try {
        return Invoke-RestMethod "https://api.themoviedb.org/3/$type/${id}?api_key=$TMDB_KEY&language=fr-FR" -ErrorAction SilentlyContinue
    } catch { return $null }
}

$total = 0

# ── Movies ──────────────────────────────────────────────────────────────────
if ($MovieEndPage -gt 0) {
    Write-Host "=== Movies pages $MovieStartPage-$MovieEndPage (sort: $MovieSort) ===" -ForegroundColor Cyan
    for ($p = $MovieStartPage; $p -le $MovieEndPage; $p++) {
        try {
            $r = Invoke-RestMethod "https://api.themoviedb.org/3/discover/movie?api_key=$TMDB_KEY&language=fr-FR&sort_by=$MovieSort&vote_count.gte=$MinVoteCount&page=$p"
            foreach ($m in $r.results) {
                $runtime     = $null
                $year        = if ($m.release_date -and $m.release_date.Length -ge 4) { [int]$m.release_date.Substring(0,4) } else { $null }
                $voteAverage = $m.vote_average
                $popularity  = $m.popularity

                if ($FetchDetail) {
                    $d = Get-TmdbDetail -id $m.id -type "movie"
                    if ($d) {
                        $runtime     = $d.runtime
                        $voteAverage = $d.vote_average
                        $popularity  = $d.popularity
                    }
                    Start-Sleep -Milliseconds 80
                }

                Seed-Item -tmdbId $m.id -title $m.title -overview $m.overview `
                    -genreIds $m.genre_ids -mediaType "movie" `
                    -year $year -runtime $runtime -voteAverage $voteAverage -popularity $popularity
                $total++
                Start-Sleep -Milliseconds 100
            }
            Write-Host "  movie page $p done ($total total)"
        } catch { Write-Host "  movie page $p error: $_" -ForegroundColor Red }
        Start-Sleep -Milliseconds 300
    }
}

# ── TV Shows ─────────────────────────────────────────────────────────────────
if ($TvEndPage -gt 0) {
    Write-Host "=== TV pages $TvStartPage-$TvEndPage (sort: $TvSort) ===" -ForegroundColor Cyan
    for ($p = $TvStartPage; $p -le $TvEndPage; $p++) {
        try {
            $r = Invoke-RestMethod "https://api.themoviedb.org/3/discover/tv?api_key=$TMDB_KEY&language=fr-FR&sort_by=$TvSort&vote_count.gte=$MinVoteCount&page=$p"
            foreach ($m in $r.results) {
                $year        = if ($m.first_air_date -and $m.first_air_date.Length -ge 4) { [int]$m.first_air_date.Substring(0,4) } else { $null }
                $voteAverage = $m.vote_average
                $popularity  = $m.popularity

                Seed-Item -tmdbId $m.id -title $m.name -overview $m.overview `
                    -genreIds $m.genre_ids -mediaType "tv" `
                    -year $year -runtime $null -voteAverage $voteAverage -popularity $popularity
                $total++
                Start-Sleep -Milliseconds 100
            }
            Write-Host "  tv page $p done ($total total)"
        } catch { Write-Host "  tv page $p error: $_" -ForegroundColor Red }
        Start-Sleep -Milliseconds 300
    }
}

Write-Host "=== Done: $total items seeded ===" -ForegroundColor Green
