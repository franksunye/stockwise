# StockWise Realtime Sync Scheduler

A precision scheduler built on Cloudflare Workers, designed to solve the inaccuracy issues of GitHub Actions' native schedule triggers.

## 🏗️ Architecture

```text
Cloudflare Worker (Cron: */10 * * * *)
        ↓
Checks if it's during trading hours (Beijing Time 09:15-16:30, Mon-Fri)
        ↓
Triggers GitHub Actions workflow_dispatch
        ↓
GitHub Actions executes the Python ETL script
```

## 🚀 Deployment Steps

### 1. Create a GitHub Personal Access Token

1. Visit [GitHub Token Settings](https://github.com/settings/tokens?type=beta).
2. Click **"Generate new token"** → **"Fine-grained token"**.
3. Configure settings:
   - **Token name**: `stockwise-scheduler`
   - **Expiration**: Choose an appropriate expiration (90 days or longer is recommended)
   - **Repository access**: Select **"Only select repositories"** → Choose `stockwise`
   - **Permissions**:
     - **Actions**: Read and Write ✅
4. Click **Generate token** and copy the token (starts with `github_pat_`).

### 2. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 3. Login to Cloudflare

```bash
wrangler login
```

This will open your browser for authorization.

### 4. Deploy the Worker

```bash
cd cloudflare-worker
wrangler deploy
```

### 5. Configure Environment Variables (Secrets)

Set up secrets via the Cloudflare Dashboard CLI:

```bash
# Set up GitHub Token (Sensitive information, must use secret)
wrangler secret put GITHUB_TOKEN
# Paste your GitHub Fine-grained Token

# Set up other variables
wrangler secret put GITHUB_OWNER
# Enter: franksunye

wrangler secret put GITHUB_REPO
# Enter: stockwise

wrangler secret put GITHUB_WORKFLOW
# Enter: data_sync_realtime.yml
```

Alternatively, configure them in the [Cloudflare Dashboard](https://dash.cloudflare.com/):
1. Navigate to **Workers & Pages**.
2. Select **stockwise-scheduler**.
3. Go to **Settings** → **Variables and Secrets**.
4. Add the following variables:

| Variable Name     | Value                    | Type       |
| ----------------- | ------------------------ | ---------- |
| `GITHUB_TOKEN`    | `github_pat_xxxx...`     | **Secret** |
| `GITHUB_OWNER`    | `franksunye`             | Variable   |
| `GITHUB_REPO`     | `stockwise`              | Variable   |
| `GITHUB_WORKFLOW` | `data_sync_realtime.yml` | Variable   |

### 6. Verify Deployment

Test by visiting the Worker URL:

```bash
# Check status
curl https://stockwise-scheduler.<your-subdomain>.workers.dev/status

# Trigger manually (for testing purposes)
curl https://stockwise-scheduler.<your-subdomain>.workers.dev/trigger
```

## 💰 Cost

**Completely Free**!

- Free Tier: 100,000 requests per day.
- Your Usage: Approximately 42 requests per day (once every 10 minutes during trading hours).
- Utilization Rate: < 0.05%.

## 📊 Monitoring

View the following in your Cloudflare Dashboard:
- Request logs
- Cron execution history
- Error details

## 🔍 Troubleshooting

**Issue: Cron is not executing**
- Check the Cron logs in the Cloudflare Dashboard.
- Ensure the Worker is fully deployed and the Cron Trigger is enabled.

**Issue: GitHub Actions are not being triggered**
- Verify that the `GITHUB_TOKEN` is set correctly.
- Ensure the Token has Actions: Read and Write permissions.
- Check error messages in the Worker logs.

**Issue: Inaccurate trading hour calculation**
- The Worker uses UTC to calculate Beijing Time.
- Check the `Beijing time` output in the logs to verify timezone conversions.
