# Déploie les edge functions Pick (Sprint A — P0.2)
# Prérequis : npx supabase login && npx supabase link --project-ref lrjhpflvkrebbngfnaif
# Secret    : npx supabase secrets set TMDB_API_KEY=<cle>

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$functions = @(
  "tmdb-proxy",
  "surprise-personalized",
  "seed-embeddings",
  "pick-chat",
  "movie-chat",
  "group-recommend",
  "identify-film",
  "sync-platform-ids",
  "enrich-french-films",
  "backfill-media-type",
  "backfill-runtime",
  "backfill-original-language"
)

Write-Host "Déploiement de $($functions.Count) edge functions..." -ForegroundColor Cyan
foreach ($fn in $functions) {
  Write-Host "  -> $fn" -ForegroundColor Yellow
  npx supabase functions deploy $fn
  if ($LASTEXITCODE -ne 0) {
    throw "Échec déploiement: $fn"
  }
}
Write-Host "Terminé." -ForegroundColor Green
