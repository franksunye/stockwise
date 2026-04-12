/**
 * StockWise Precision Scheduler
 * 
 * 这个 Cloudflare Worker 作为精准调度器，支持：
 * 1. 每个工作日 20:30 精确触发 trade_management_advice_loop.yml
 * 2. 每 15 分钟检查一次早报与交易时段内的 realtime sync
 */

/**
 * JOB_REGISTRY: 核心任务注册表 (BJT)
 * 仅在每 15 分钟 (xx:00, xx:15, xx:30, xx:45) 的心跳时刻执行精确匹配
 */
const JOB_REGISTRY = [
  {
    hour: 6, minute: 30, days: [2, 3, 4, 5, 6],
    workflow: 'daily_pipeline_us.yml',
    label: 'us-pipeline-settlement',
  },
  {
    hour: 8, minute: 30, days: [1, 2, 3, 4, 5],
    workflow: 'daily_morning_call.yml',
    label: 'cn-morning-call',
  },
  {
    hour: 8, minute: 30, days: [2, 3, 4, 5, 6],
    workflow: 'daily_validation_check_us.yml',
    label: 'us-validation-glory', // 美股清晨战报 (对齐至 08:30 格点)
  },
  {
    hour: 16, minute: 0, days: [1, 2, 3, 4, 5],
    workflow: 'daily_pipeline_cn_main.yml',
    label: 'cn-pipeline-settlement',
  },
  {
    hour: 16, minute: 30, days: [1, 2, 3, 4, 5],
    workflow: 'daily_pipeline_hk.yml',
    label: 'hk-pipeline-settlement',
  },
  {
    hour: 20, minute: 30, days: [1, 2, 3, 4, 5],
    workflow: 'trade_management_advice_loop.yml',
    label: 'trade-management-advice',
  },
  {
    hour: 20, minute: 30, days: [1, 2, 3, 4, 5],
    workflow: 'daily_morning_call_us.yml',
    label: 'us-morning-call',
  },
];

function getBeijingContext(now = new Date()) {
  const beijingOffset = 8 * 60;
  const utcMinutesTotal = now.getUTCHours() * 60 + now.getUTCMinutes();
  const beijingMinutesTotal = (utcMinutesTotal + beijingOffset) % (24 * 60);
  const beijingHour = Math.floor(beijingMinutesTotal / 60);
  const beijingMinute = beijingMinutesTotal % 60;

  let beijingDay = now.getUTCDay();
  if (utcMinutesTotal + beijingOffset >= 24 * 60) {
    beijingDay = (beijingDay + 1) % 7;
  }

  return { beijingMinutesTotal, beijingHour, beijingMinute, beijingDay };
}

function getUSEasternContext(now = new Date()) {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const etMinutesTotal = et.getHours() * 60 + et.getMinutes();
  const etDay = et.getDay();
  return { et, etMinutesTotal, etDay };
}

export default {
  // Cron Trigger 入口 (已配置为每 15 分钟触发一次)
  async scheduled(event, env, ctx) {
    console.log(`⏰ Heartbeat triggered at ${new Date().toISOString()}`);

    const now = new Date();
    const { beijingMinutesTotal, beijingHour, beijingMinute, beijingDay } = getBeijingContext(now);
    const { et, etMinutesTotal, etDay } = getUSEasternContext(now);

    console.log(`🕙 Beijing Time: ${String(beijingHour).padStart(2, '0')}:${String(beijingMinute).padStart(2, '0')} (Day: ${beijingDay})`);
    console.log(`🗽 US Eastern Time: ${et.toISOString().replace('T', ' ').substring(0, 19)} (Day: ${etDay})`);

    // 2. 精确任务匹配 (Precision Hits) - 增加 5 分钟容错窗口，防止分钟级漂移
    const hits = JOB_REGISTRY.filter((job) => {
      const jobMinutesTotal = job.hour * 60 + job.minute;
      let diff = Math.abs(beijingMinutesTotal - jobMinutesTotal);
      // 处理跨天边界 (e.g., 23:59 匹配 00:00)
      if (diff > 720) diff = 1440 - diff;
      
      const timeMatch = diff <= 5;
      const dayMatch = !job.days || job.days.includes(beijingDay);
      return timeMatch && dayMatch;
    });

    if (hits.length > 0) {
      console.log(`🎯 Precision Hits! Triggering ${hits.length} workflow(s)...`);
      for (const hit of hits) {
        const result = await triggerGitHubWorkflow(env, hit.workflow);
        console.log(`✅ [${hit.label}] triggered:`, result);
      }
    }

    // 3. 全球实时同步逻辑 (Realtime Sync & Radar)
    // A. 中港时段: 09:15 - 16:30
    const cnStart = 9 * 60 + 15;
    const cnEnd = 16 * 60 + 30;
    // B. 美股时段: 21:30 - 05:00 (跨天判断)
    const usStart = 21 * 60 + 30;
    const usEnd = 300; // 05:00

    let isTrading = (beijingMinutesTotal >= cnStart && beijingMinutesTotal <= cnEnd);
    if (!isTrading) {
      const isUSEquitySession = (etDay >= 1 && etDay <= 5) && (etMinutesTotal >= 9 * 60 + 30 && etMinutesTotal <= 16 * 60);
      if (isUSEquitySession || beijingMinutesTotal >= usStart || beijingMinutesTotal <= usEnd) {
        isTrading = true;
      }
    }

    const isCnHkWeekday = beijingDay >= 1 && beijingDay <= 5;
    const isUsWeekday = etDay >= 1 && etDay <= 5;
    const shouldRunRealtime =
      (beijingMinutesTotal >= cnStart && beijingMinutesTotal <= cnEnd && isCnHkWeekday) ||
      ((beijingMinutesTotal >= usStart || beijingMinutesTotal <= usEnd) && isUsWeekday);

    if (isTrading && shouldRunRealtime) {
      console.log(`📊 Global Trading Windows Active. Triggering heartbeat sync...`);
      const result = await triggerGitHubWorkflow(env, env.GITHUB_WORKFLOW || 'data_sync_realtime.yml');
      console.log(`✅ Realtime Sync triggered:`, result);
    } else {
      console.log(`🌙 Non-trading hours or weekend. Realtime sync skipped.`);
    }
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
        github_repo: `${env.GITHUB_OWNER || 'N/A'}/${env.GITHUB_REPO || 'N/A'}`,
        workflow: env.GITHUB_WORKFLOW || 'data_sync_realtime.yml',
        job_registry: JOB_REGISTRY,
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
