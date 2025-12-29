# Run StockWise AI Analysis for Production (Turso)

$EnvFile = "..\.env"

Write-Host ">>> Starting StockWise Remote Analysis..." -ForegroundColor Cyan

if (-not (Test-Path $EnvFile)) {
    Write-Host "X Error: .env file not found." -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and fill in your Turso credentials." -ForegroundColor Yellow
    exit 1
}

# Set encoding for Python output
$env:PYTHONIOENCODING = "utf-8"

# 1. config.py will load TURSO_* from .env
# 2. database.py will connect to Turso
# 3. main.py --analyze will use local LLM to generate predictions
python main.py --analyze

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n>>> SUCCESS: AI predictions pushed to Turso." -ForegroundColor Green
} else {
    Write-Host "`n>>> FAILED: Please check the logs above." -ForegroundColor Red
}
