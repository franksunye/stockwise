
# 脚本功能：自动获取PRO用户关注股票并执行本地AI预测
# 用法：./run_prediction.ps1 [-Force] [-Model "gemini-3-flash"]

param (
    [switch]$Force,
    [string]$Model = "gemini-3-flash"
)

# 1. 设置环境变量，确保写入线上数据库
$env:DB_SOURCE = "cloud"
Write-Host "🌍 环境已设置为: DB_SOURCE=cloud (线上数据库)" -ForegroundColor Yellow

# 2. 获取 PRO 用户关注的去重股票列表
Write-Host "🔍 正在查询 PRO 用关注的股票列表..." -ForegroundColor Cyan
$query = "SELECT DISTINCT w.symbol FROM user_watchlist w JOIN users u ON w.user_id = u.user_id WHERE u.subscription_tier = 'pro'"
$jsonOutput = node frontend/scripts/turso-cli.mjs query $query --raw
# 简单的 JSON 解析 (假设输出格式稳定，或者使用 ConvertFrom-Json 如果输出是纯JSON)
# 注意：turso-cli 输出可能包含非 JSON 日志，这里我们需要更稳健的解析方式
# 为了简化，我们直接再次运行命令获取纯文本列表或者解析之前的输出
# 这里我们采用一种更直接的方法：让 turso-cli 只输出我们想要的数据，或者我们在 PS 中处理
# 临时方案：再次调用 turso-cli 这是一个通用的操作，我们用正则提取

$proSymbols = @()
if ($jsonOutput -match "'(\d{5,6})'") {
    $proSymbols = $matches[0] # 这只能匹配一个，我们需要所有
}

# 更可靠的方法：使用 regex 匹配所有 symbol
$pattern = "'(\d{5,6})'"
$regex = [regex]::new($pattern)
$matches = $regex.Matches($jsonOutput)

if ($matches.Count -eq 0) {
    Write-Host "⚠️ 未找到 PRO 用户关注的股票或提取失败。" -ForegroundColor Red
    Write-Host "原始输出: $jsonOutput"
    exit 1
}

$symbols = @()
foreach ($match in $matches) {
    $symbols += $match.Groups[1].Value
}
# 去重
$symbols = $symbols | Select-Object -Unique

Write-Host "✅ 找到 $($symbols.Count) 只目标股票: $($symbols -join ', ')" -ForegroundColor Green

# 3. 批量执行预测
$params = @("--analyze", "--model", $Model)
if ($Force) {
    $params += "--force"
}

$total = $symbols.Count
$current = 0

foreach ($s in $symbols) {
    $current++
    Write-Host "`n[$current/$total] 🚀 正在分析 $s ..." -ForegroundColor Cyan
    
    # 构造参数
    $cmdParams = $params + "--symbol", $s
    
    # 执行 python 脚本
    python backend/main.py @cmdParams
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 分析 $s 失败" -ForegroundColor Red
    } else {
        Write-Host "✅ 分析 $s 完成" -ForegroundColor Green
    }

    # 冷却时间，防止 429
    if ($current -lt $total) {
        $sleepSeconds = 5
        Write-Host "⏳ 冷却 $sleepSeconds 秒..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $sleepSeconds
    }
}

# 4. 验证结果
Write-Host "`n📊 正在验证今日预测结果..." -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
$verifyQuery = "SELECT COUNT(*) as total FROM ai_predictions_v2 WHERE date = '$today' AND model_id = '$Model'"
# 这里直接打印命令供用户确认，或者解析输出
Write-Host "请运行以下命令验证最终数量：" -ForegroundColor Yellow
Write-Host "node frontend/scripts/turso-cli.mjs query `"$verifyQuery`""

Write-Host "`n🎉 所有任务执行完毕。" -ForegroundColor Green
