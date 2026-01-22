# Auto-fetch PRO user stocks and run local AI prediction (Safe Version)
# Usage: ./run_prediction.ps1 [-Force] [-Model "gemini-3-flash"]

param (
    [switch]$Force,
    [string]$Model = "gemini-3-flash"
)

# 1. Set environment to Cloud
$env:DB_SOURCE = "cloud"
Write-Host "Environment set to: DB_SOURCE=cloud (Production DB)" -ForegroundColor Yellow

# 2. Get PRO user watchlist
Write-Host "Querying PRO user watchlist..." -ForegroundColor Cyan
$query = "SELECT DISTINCT w.symbol FROM user_watchlist w JOIN users u ON w.user_id = u.user_id WHERE u.subscription_tier = 'pro'"
$jsonOutput = node frontend/scripts/turso-cli.mjs query $query --raw

# Parse output (simple regex for symbols like '000000')
$pattern = "'(\d{5,6})'"
$regex = [regex]::new($pattern)
$matches = $regex.Matches($jsonOutput)

if ($matches.Count -eq 0) {
    Write-Host "No PRO user stocks found or extraction failed." -ForegroundColor Red
    Write-Host "Raw Output: $jsonOutput"
    exit 1
}

$symbols = @()
foreach ($match in $matches) {
    $symbols += $match.Groups[1].Value
}
# Deduplicate
$symbols = $symbols | Select-Object -Unique

Write-Host "Found $($symbols.Count) target stocks: $($symbols -join ', ')" -ForegroundColor Green

# 3. Batch Execution
$params = @("--analyze", "--model", $Model)
if ($Force) {
    $params += "--force"
}

$total = $symbols.Count
$current = 0

foreach ($s in $symbols) {
    $current++
    Write-Host "`n[$current/$total] Analyzing $s ..." -ForegroundColor Cyan
    
    # Construct args
    $cmdParams = $params + "--symbol", $s
    
    # Run python
    python backend/main.py @cmdParams
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to analyze $s" -ForegroundColor Red
    } else {
        Write-Host "Analyzed $s Successfully" -ForegroundColor Green
    }

    # Cooldown
    if ($current -lt $total) {
        $sleepSeconds = 5
        Write-Host "Cooling down $sleepSeconds seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $sleepSeconds
    }
}

# 4. Verification Hint
Write-Host "`nVerifying today's results..." -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
$verifyQuery = "SELECT COUNT(*) as total FROM ai_predictions_v2 WHERE date = '$today' AND model_id = '$Model'"
Write-Host "Run this to verify:" -ForegroundColor Yellow
Write-Host "node frontend/scripts/turso-cli.mjs query `"$verifyQuery`""

Write-Host "`nAll tasks completed." -ForegroundColor Green
