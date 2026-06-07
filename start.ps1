# VERTEX RD — Iniciar geoportal + API en http://localhost:8000
$root = $PSScriptRoot

Write-Host "=== VERTEX RD Geoportal ===" -ForegroundColor Cyan

$db = Join-Path $root "data\predios.db"
if (-not (Test-Path $db)) {
    Write-Host "Exportando 140K predios..." -ForegroundColor Yellow
    python "$root\scripts\export_predios_full.py"
}

Write-Host "Generando config.local.js desde .env..." -ForegroundColor Gray
python "$root\scripts\generate_local_config.py"

Write-Host ""
Write-Host "Abre en el navegador:" -ForegroundColor Green
Write-Host "  http://localhost:8000" -ForegroundColor White
Write-Host "  http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""

Set-Location "$root\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
