/**
 * StockWise Realtime Sync Scheduler
 * 
 * 这个 Cloudflare Worker 作为精准调度器，每 10 分钟触发一次 GitHub Actions workflow。
 * 解决了 GitHub Actions schedule 不精准的问题。
 */

export default {
  // Cron Trigger 入口
  async scheduled(event, env, ctx) {
    console.log(`⏰ Cron triggered at ${new Date().toISOString()}`);
    
    // 计算北京时间
    const now = new Date();
    const beijingOffset = 8 * 60; // UTC+8
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const beijingMinutes = (utcMinutes + beijingOffset) % (24 * 60);
    const beijingHour = Math.floor(beijingMinutes / 60);
    const beijingMinute = beijingMinutes % 60;
    
    // 周几 (0=周日, 1=周一, ..., 6=周六)
    let beijingDay = now.getUTCDay();
    if (utcMinutes + beijingOffset >= 24 * 60) {
      beijingDay = (beijingDay + 1) % 7;
    }
    
    // 只在周一到周五执行
    if (beijingDay === 0 || beijingDay === 6) {
      console.log(`📅 Weekend (Beijing day: ${beijingDay}), skipping...`);
      return;
    }
    
    const currentMinutes = beijingHour * 60 + beijingMinute;
    
    // ========== 早报任务检测 (08:30 北京时间) ==========
    const morningCallTime = 8 * 60 + 30; // 08:30
    // 允许 5 分钟的窗口 (08:25 - 08:35)
    if (currentMinutes >= morningCallTime - 5 && currentMinutes <= morningCallTime + 5) {
      console.log(`☀️ Morning Call time (Beijing: ${beijingHour}:${String(beijingMinute).padStart(2, '0')}), triggering daily_morning_call...`);
      const result = await triggerGitHubWorkflow(env, 'daily_morning_call.yml');
      console.log(`✅ Morning Call workflow triggered:`, result);
      return;
    }
    
    // ========== 实时同步任务检测 (09:10 - 16:10) ==========
    const tradingStart = 9 * 60 + 10;  // 09:10
    const tradingEnd = 16 * 60 + 10;   // 16:10
    
    if (currentMinutes < tradingStart || currentMinutes > tradingEnd) {
      console.log(`🌙 Outside trading hours (Beijing: ${beijingHour}:${String(beijingMinute).padStart(2, '0')}), skipping realtime sync...`);
      return;
    }
    
    console.log(`📊 Trading hours active (Beijing: ${beijingHour}:${String(beijingMinute).padStart(2, '0')}), triggering sync...`);
    
    // 触发 GitHub Actions realtime sync workflow
    const result = await triggerGitHubWorkflow(env, env.GITHUB_WORKFLOW || 'data_sync_realtime.yml');
    console.log(`✅ GitHub Actions triggered:`, result);
  },
  
  // HTTP 请求入口 (用于手动测试)
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/trigger') {
      // 手动触发 (用于测试)
      const result = await triggerGitHubWorkflow(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/status') {
      // 状态检查
      const now = new Date();
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      return new Response(JSON.stringify({
        service: 'StockWise Realtime Sync Scheduler',
        status: 'running',
        utc_time: now.toISOString(),
        beijing_time: beijingTime.toISOString().replace('T', ' ').substring(0, 19),
        github_repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
        workflow: env.GITHUB_WORKFLOW
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('StockWise Scheduler - Use /status or /trigger', { status: 200 });
  }
};

async function triggerGitHubWorkflow(env, workflowFile = null) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_WORKFLOW } = env;
  
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('Missing required environment variables');
  }
  
  const targetWorkflow = workflowFile || GITHUB_WORKFLOW || 'data_sync_realtime.yml';
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${targetWorkflow}/dispatches`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'StockWise-Scheduler',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: 'main'  // 目标分支
    })
  });
  
  if (response.status === 204) {
    return { success: true, message: 'Workflow triggered successfully' };
  }
  
  const errorText = await response.text();
  return { 
    success: false, 
    status: response.status,
    error: errorText 
  };
}
