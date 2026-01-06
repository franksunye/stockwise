$symbols = @('000547', '002389', '00700', '01167', '01398', '02171', '300395', '300502', '301522', '600118', '601398', '601698', '688068', '688256')

foreach ($s in $symbols) { 
    Write-Host "正在分析 $s ..." -ForegroundColor Cyan
    
    # 执行分析命令
    python backend/main.py --analyze --symbol $s --force
    
    # 冷却时间 (Cool Down) - 防止 Turso/SQLite 连接过载
    Write-Host "冷却 5 秒..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 5 
}
