$symbols = @("000547", "002413", "00700", "01167", "01398", "02171", "300395", "300502", "600118", "600678", "601398", "601698", "688068", "688256")

$env:DB_SOURCE = "cloud"
$env:LLM_BASE_URL = "http://127.0.0.1:8045/v1"
if (-not $env:LLM_API_KEY) { $env:LLM_API_KEY = "sk-any" }

Write-Host "Starting Manual Analysis..."

foreach ($s in $symbols) {
    Write-Host "----------------"
    Write-Host "Processing $s"
    python backend/main.py --analyze --symbol $s --force --model gemini-3-flash
    Start-Sleep -Seconds 2
}

Write-Host "Done"
