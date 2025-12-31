# Run StockWise AI Analysis for Production (Turso)
# 
# 使用方法：
# ============ 基础模式 ============
#   .\run_prod_analysis.ps1              # 分析全部股票池 (最新数据)
#   .\run_prod_analysis.ps1 -Symbol 600519  # 仅分析指定股票
#   .\run_prod_analysis.ps1 -Market CN    # 仅分析 A 股
#   .\run_prod_analysis.ps1 -Market HK    # 仅分析港股
#
# ============ 回填模式 ============
#   .\run_prod_analysis.ps1 -Date 2025-12-30              # 补指定日期
#   .\run_prod_analysis.ps1 -StartDate 2025-12-23 -EndDate 2025-12-30  # 补日期范围
#   .\run_prod_analysis.ps1 -Days 7                       # 补最近7天
#   .\run_prod_analysis.ps1 -AutoFill                     # 智能补充缺失分析
#   .\run_prod_analysis.ps1 -Symbol 600519 -Days 7        # 指定股票补最近7天

param(
    [string]$Symbol,
    [ValidateSet("CN", "HK")]
    [string]$Market,
    [string]$Date,           # 单日回填
    [string]$StartDate,      # 范围起始
    [string]$EndDate,        # 范围结束
    [int]$Days,              # 最近N天
    [switch]$AutoFill        # 智能补充
)

$EnvFile = "..\.env"

if (-not (Test-Path $EnvFile)) {
    Write-Host "X Error: .env file not found." -ForegroundColor Red
    Write-Host "Please copy .env.example to .env and fill in your Turso credentials." -ForegroundColor Yellow
    exit 1
}

# Set encoding for Python output
$env:PYTHONIOENCODING = "utf-8"

# Build command arguments
$pythonArgs = @("main.py", "--analyze")

# 判断是否为回填模式
$isBackfillMode = $Date -or $StartDate -or $EndDate -or $Days -or $AutoFill

if ($Symbol) {
    $pythonArgs += "--symbol"
    $pythonArgs += $Symbol
}

if ($Market) {
    $pythonArgs += "--market"
    $pythonArgs += $Market
}

# 回填模式参数
if ($Date) {
    Write-Host ">>> [回填模式] 补充日期: $Date" -ForegroundColor Magenta
    $pythonArgs += "--date"
    $pythonArgs += $Date
}

if ($StartDate) {
    $pythonArgs += "--start-date"
    $pythonArgs += $StartDate
}

if ($EndDate) {
    $pythonArgs += "--end-date"
    $pythonArgs += $EndDate
}

if ($StartDate -and $EndDate) {
    Write-Host ">>> [回填模式] 日期范围: $StartDate ~ $EndDate" -ForegroundColor Magenta
}

if ($Days) {
    Write-Host ">>> [回填模式] 最近 $Days 天" -ForegroundColor Magenta
    $pythonArgs += "--days"
    $pythonArgs += $Days
}

if ($AutoFill) {
    Write-Host ">>> [智能模式] 自动检测并补充缺失分析..." -ForegroundColor Cyan
    $pythonArgs += "--auto-fill"
}

# 普通模式的提示
if (-not $isBackfillMode) {
    if ($Symbol) {
        Write-Host ">>> Starting StockWise AI Analysis for: $Symbol" -ForegroundColor Cyan
    } elseif ($Market) {
        Write-Host ">>> Starting StockWise AI Analysis for Market: $Market" -ForegroundColor Cyan
    } else {
        Write-Host ">>> Starting StockWise Remote Analysis (Full Pool)..." -ForegroundColor Cyan
    }
}

# Execute
python @pythonArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n>>> SUCCESS: AI predictions pushed to Turso." -ForegroundColor Green
} else {
    Write-Host "`n>>> FAILED: Please check the logs above." -ForegroundColor Red
}
