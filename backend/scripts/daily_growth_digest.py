import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, List
from dotenv import load_dotenv

# Ensure we can import from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env from backend/.env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
load_dotenv(env_path, override=True)

from database import get_connection
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
    OrderBy
)

def get_ga4_report(property_id: str, credentials_path: str):
    """
    Fetches the last 24h traffic from GA4.
    """
    # Set the credentials environment variable for the client library
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
    
    client = BetaAnalyticsDataClient()
    
    # 1. Traffic & Conversion Overview
    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="date")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="conversions"),
            Metric(name="screenPageViews")
        ],
        date_ranges=[DateRange(start_date="1daysAgo", end_date="today")],
    )
    
    response = client.run_report(request)
    
    summary = {
        "sessions": 0,
        "users": 0,
        "conversions": 0,
        "page_views": 0
    }
    
    for row in response.rows:
        summary["sessions"] += int(row.metric_values[0].value)
        summary["users"] += int(row.metric_values[1].value)
        summary["conversions"] += int(row.metric_values[2].value)
        summary["page_views"] += int(row.metric_values[3].value)
        
    # 2. Top landing pages
    page_request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="pagePath")],
        metrics=[Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="1daysAgo", end_date="today")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="activeUsers"), desc=True)],
        limit=5
    )
    page_resp = client.run_report(page_request)
    top_pages = []
    for row in page_resp.rows:
        top_pages.append({"path": row.dimension_values[0].value, "users": row.metric_values[0].value})

    # 3. Top traffic sources
    source_request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="sessionSource")],
        metrics=[Metric(name="sessions")],
        date_ranges=[DateRange(start_date="1daysAgo", end_date="today")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=5
    )
    source_resp = client.run_report(source_request)
    top_sources = []
    for row in source_resp.rows:
        top_sources.append({"source": row.dimension_values[0].value, "sessions": row.metric_values[0].value})
        
    return summary, top_pages, top_sources

def get_clarity_metrics(token: str):
    """
    Fetches aggregate negativity signals from Microsoft Clarity.
    """
    url = "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            raw_data = response.json()
            
            # Clarity might return a list of project data
            data = raw_data[0] if isinstance(raw_data, list) and len(raw_data) > 0 else raw_data
            if not isinstance(data, dict):
                return None
                
            # Extract common metrics
            return {
                "dead_clicks": data.get("deadClickCount", 0),
                "rage_clicks": data.get("rageClickCount", 0),
                "error_clicks": data.get("errorClickCount", 0),
                "avg_engagement_ms": data.get("avgEngagementTime", 0)
            }
        else:
            print(f"⚠️ Clarity API warning: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"⚠️ Clarity API error: {e}")
        return None

def get_internal_metrics():
    """
    Fetches the last 24h signups and activity from the DB.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # New users in last 24h (considering +8h offset)
    cursor.execute("""
        SELECT COUNT(*) FROM users 
        WHERE created_at > datetime('now', '-24 hours', '+8 hours')
    """)
    new_signups = cursor.fetchone()[0]
    
    # Active watchers (users who added something in last 24h)
    cursor.execute("""
        SELECT COUNT(DISTINCT user_id) FROM user_watchlist 
        WHERE added_at > datetime('now', '-24 hours', '+8 hours')
    """)
    active_watchers = cursor.fetchone()[0]
    
    # Top added symbols
    cursor.execute("""
        SELECT symbol, COUNT(*) as count FROM user_watchlist 
        WHERE added_at > datetime('now', '-24 hours', '+8 hours')
        GROUP BY symbol ORDER BY count DESC LIMIT 5
    """)
    top_symbols = [{"symbol": row[0], "count": row[1]} for row in cursor.fetchall()]
    
    # Total user breakdown
    cursor.execute("SELECT subscription_tier, COUNT(*) FROM users GROUP BY subscription_tier")
    tiers = {row[0]: row[1] for row in cursor.fetchall()}
    
    conn.close()
    return {
        "new_signups": new_signups,
        "active_watchers": active_watchers,
        "top_symbols": top_symbols,
        "tiers": tiers
    }

def generate_report():
    print("--- 🚀 StockWise Daily Growth Pulse ---")
    
    property_id = os.environ.get("GA4_PROPERTY_ID")
    credentials_path = os.environ.get("GA4_CREDENTIALS_PATH")
    clarity_token = os.environ.get("CLARITY_API_TOKEN")
    
    if not property_id or not credentials_path:
        print("❌ Error: GA4_PROPERTY_ID or GA4_CREDENTIALS_PATH not found in environment.")
        return

    try:
        ga_summary, top_pages, top_sources = get_ga4_report(property_id, credentials_path)
        internal = get_internal_metrics()
        
        clarity_data = None
        if clarity_token:
            clarity_data = get_clarity_metrics(clarity_token)
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        report_md = f"""# StockWise Growth Pulse ({timestamp})

## 📊 Summary (Last 24h)
| Metric | Count | Source |
| :--- | :--- | :--- |
| **Total Sessions** | {ga_summary['sessions']} | GA4 |
| **New Signups** | {internal['new_signups']} | DB |
| **Conversion Rate** | {((internal['new_signups'] / ga_summary['sessions'] * 100) if ga_summary['sessions'] > 0 else 0):.2f}% | Derived |
| **Active Watchers** | {internal['active_watchers']} | DB |
| **Total Page Views** | {ga_summary['page_views']} | GA4 |

"""
        if clarity_data:
            report_md += f"""## ⚠️ UX Friction Signals (Clarity)
| Metric | Count | Insight |
| :--- | :--- | :--- |
| **Dead Clicks** | {clarity_data['dead_clicks']} | Potential broken UI elements |
| **Rage Clicks** | {clarity_data['rage_clicks']} | User frustration detected |
| **Error Clicks** | {clarity_data['error_clicks']} | JS errors or broken links |
| **Avg Engagement** | {clarity_data['avg_engagement_ms']/1000 if clarity_data['avg_engagement_ms'] else 0:.1f}s | Session duration |

"""

        report_md += f"""## 🧩 User Base Breakdown
- **Free**: {internal['tiers'].get('free', 0)}
- **Go/Plus/Pro**: {internal['tiers'].get('go', 0) + internal['tiers'].get('plus', 0) + internal['tiers'].get('pro', 0)}
- **Ghost Users Cleaned (Cumulative)**: Done
"""

        report_md += "\n## 📡 Top Traffic Sources (GA4)\n"
        for s in top_sources:
            report_md += f"- **{s['source']}**: {s['sessions']} sessions\n"
            
        report_md += "\n## 📄 Top Landing Pages (GA4)\n"
        for p in top_pages:
            report_md += f"- `{p['path']}`: {p['users']} active users\n"
            
        report_md += "\n## 🔥 Trending Symbols (Internal Watchlist)\n"
        if not internal['top_symbols']:
             report_md += "No new additions in the last 24h.\n"
        else:
            for item in internal['top_symbols']:
                report_md += f"- **{item['symbol']}**: {item['count']} additions\n"

        print(report_md)
        
        # Save to file
        os.makedirs("tmp", exist_ok=True)
        report_file = "tmp/latest_growth_pulse.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report_md)
        print(f"\n✅ Report generated and saved to: {report_file}")
        
    except Exception as e:
        print(f"❌ Failed to generate growth report: {e}")

if __name__ == "__main__":
    generate_report()
