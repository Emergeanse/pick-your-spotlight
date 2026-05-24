##############################################################################
# backfill-original-language.ps1
#
# Appelle l'edge function backfill-original-language en boucle jusqu'à
# ce que tous les films aient original_language rempli.
#
# Utilisation :
#   .\scripts\backfill-original-language.ps1
##############################################################################

param(
    [int]$BatchSize = 100,   # films traités par appel
    [int]$DelayMs   = 2000   # pause entre chaque appel (ms)
)

$SUPABASE_URL = "https://lrjhpflvkrebbngfnaif.supabase.co"
$ANON_KEY     = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyamhwZmx2a3JlYmJuZ2ZuYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODMwODMsImV4cCI6MjA4ODc1OTA4M30.uqrxehgcnJTHmhGcmSKpu8GNngUkSE5iuHUcw7z4tPk"

$endpoint = "$SUPABASE_URL/functions/v1/backfill-original-language"
$headers  = @{
    "Authorization" = "Bearer $ANON_KEY"
    "Content-Type"  = "application/json"
}
$body = @{ batchSize = $BatchSize } | ConvertTo-Json

$totalUpdated = 0
$round        = 0

Write-Host "Démarrage du backfill (batchSize=$BatchSize)..." -ForegroundColor Cyan

do {
    $round++
    try {
        $result = Invoke-RestMethod $endpoint -Method POST -Headers $headers -Body $body -ErrorAction Stop
        $totalUpdated += $result.updated
        Write-Host "Tour $round — traités: $($result.processed) | mis à jour: $($result.updated) | erreurs: $($result.errors) | restants: $($result.remaining) | total cumulé: $totalUpdated" -ForegroundColor $(if ($result.errors -gt 0) { "Yellow" } else { "Green" })

        if ($result.remaining -le 0) {
            Write-Host "`nBackfill terminé ! $totalUpdated films mis à jour au total." -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "Erreur appel edge function: $_" -ForegroundColor Red
        break
    }

    Start-Sleep -Milliseconds $DelayMs

} while ($true)
