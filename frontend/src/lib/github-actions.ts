
/**
 * 触发 GitHub Action 异步同步特定股票数据
 */
export async function triggerOnDemandSync(symbol: string) {
    const pat = process.env.GITHUB_PAT;
    const owner = 'franksunye';
    const repo = 'stockwise';
    const workflowId = 'data_sync_single.yml'; // 确保文件名正确

    if (!pat) {
        console.warn('⚠️ GITHUB_PAT not found in environment, skipping on-demand sync');
        return false;
    }

    try {
        console.log(`📡 Triggering GitHub Action [${workflowId}] for symbol: ${symbol}`);

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${pat}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: { symbol }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ GitHub API error (${response.status}): ${errorText}`);
            return false;
        }

        console.log(`🚀 Successfully triggered GitHub sync for ${symbol}`);
        return true;
    } catch (error) {
        console.error(`❌ Unexpected error triggering GitHub sync for ${symbol}:`, error);
        return false;
    }
}
