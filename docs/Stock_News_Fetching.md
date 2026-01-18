# 个股新闻获取方案

> 本文档描述了 StockWise 项目中获取个股实时新闻的技术方案，用于替代昂贵的 Gemini Search Grounding。

## 背景

| 方案                    | 费用                 | 评估             |
| ----------------------- | -------------------- | ---------------- |
| Gemini Search Grounding | $0.035/次 (~0.25 元) | ❌ 太贵           |
| AkShare `stock_news_em` | 免费                 | ⚠️ 当前版本不稳定 |
| **东财 API 直连**       | 免费                 | ✅ 推荐           |

## 技术方案

### 接口地址
```
GET http://search-api-web.eastmoney.com/search/jsonp
```

### 请求参数
```python
params = {
    "cb": "jQuery_callback",  # JSONP回调名（可自定义）
    "param": json.dumps({
        "uid": "",
        "keyword": "00700",  # 股票代码或公司名称
        "type": ["cmsArticle"],
        "client": "web",
        "clientType": "web",
        "clientVersion": "curr",
        "param": {
            "cmsArticle": {
                "searchScope": "default",
                "sort": "default",
                "pageIndex": 1,
                "pageSize": 100,
                "preTag": "",
                "postTag": ""
            }
        }
    })
}
```

### 响应解析
响应为 JSONP 格式，需要提取 JSON 内容：
```python
import re
import json

match = re.search(r'^[^(]*\((.*)\);?$', response_text.strip(), re.DOTALL)
if match:
    data = json.loads(match.group(1))
    articles = data["result"]["cmsArticle"]
```

### 返回字段

| 字段        | 说明     |
| ----------- | -------- |
| `title`     | 新闻标题 |
| `content`   | 新闻摘要 |
| `date`      | 发布时间 |
| `mediaName` | 来源媒体 |
| `code`      | 文章ID   |

## 过滤策略

东财搜索会返回**正文中任意位置提及关键词**的新闻，因此需要二次过滤：

```python
def filter_focused_news(articles, symbol, name_keywords):
    """只保留标题中直接提及该股票的新闻"""
    filter_terms = [symbol] + (name_keywords or [])
    return [
        a for a in articles
        if any(term.lower() in a["title"].lower() for term in filter_terms)
    ]
```

### 过滤效果示例

| 股票              | 原始数量 | 过滤后 |
| ----------------- | -------- | ------ |
| 腾讯控股 (00700)  | 100 条   | 20 条  |
| 贵州茅台 (600519) | 100 条   | 55 条  |

## 代码示例

```python
import requests
import json
import re

def fetch_stock_news(symbol: str, name_keywords: list = None, limit: int = 10):
    """
    获取个股新闻
    
    Args:
        symbol: 股票代码，如 "00700" 或 "600519"
        name_keywords: 公司名称关键词列表，如 ["腾讯", "Tencent"]
        limit: 返回条数
    
    Returns:
        list: 新闻列表 [{title, date, source, content}, ...]
    """
    url = "http://search-api-web.eastmoney.com/search/jsonp"
    params = {
        "cb": "jQuery_callback",
        "param": json.dumps({
            "uid": "",
            "keyword": symbol,
            "type": ["cmsArticle"],
            "client": "web",
            "clientType": "web", 
            "clientVersion": "curr",
            "param": {
                "cmsArticle": {
                    "searchScope": "default",
                    "sort": "default",
                    "pageIndex": 1,
                    "pageSize": 100,
                    "preTag": "",
                    "postTag": ""
                }
            }
        })
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Referer": f"https://so.eastmoney.com/news/s?keyword={symbol}"
    }
    
    resp = requests.get(url, params=params, headers=headers, timeout=10)
    match = re.search(r'^[^(]*\((.*)\);?$', resp.text.strip(), re.DOTALL)
    
    if not match:
        return []
    
    data = json.loads(match.group(1))
    articles = data.get("result", {}).get("cmsArticle", [])
    
    # 标题过滤
    filter_terms = [symbol] + (name_keywords or [])
    focused = [
        a for a in articles
        if any(t.lower() in a.get("title", "").lower() for t in filter_terms)
    ]
    
    # 格式化输出
    return [
        {
            "title": a["title"].replace("<em>", "").replace("</em>", ""),
            "date": a.get("date", ""),
            "source": a.get("mediaName", ""),
            "content": a.get("content", "")[:200]
        }
        for a in focused[:limit]
    ]
```

## 使用场景

1. **AI 分析前的新闻注入**：在生成预测前，获取最新新闻摘要，注入 Prompt
2. **异常检测**：检查是否有重大利好/利空新闻
3. **用户展示**：在前端展示个股相关新闻流

## 已知限制

- 港股代码需使用纯数字格式（如 `00700`，不带 `.HK`）
- 接口返回上限约 100 条
- 部分新闻可能有延迟（约 5-30 分钟）

## 验证脚本

测试脚本位于：`scripts/demo_tencent_news.py`

---

## 备选方案：yfinance (国际新闻)

> yfinance 可作为东财 API 的补充，用于获取英文国际视角的新闻。

### 安装
```bash
pip install yfinance
```

### 代码示例
```python
import yfinance as yf

def fetch_yfinance_news(symbol: str, limit: int = 5):
    """
    使用 yfinance 获取股票新闻（英文）
    
    Args:
        symbol: 股票代码，港股加 .HK，A股加 .SS/.SZ
                如 "0700.HK", "2171.HK", "600519.SS"
    """
    ticker = yf.Ticker(symbol)
    news = ticker.news or []
    
    return [
        {
            "title": item.get("title", ""),
            "summary": item.get("summary", "")[:200],
            "date": item.get("pubDate", ""),
            "source": item.get("provider", {}).get("displayName", ""),
            "url": item.get("canonicalUrl", {}).get("url", "")
        }
        for item in news[:limit]
    ]
```

### 特点对比

| 特性         | 东财 API           | yfinance               |
| ------------ | ------------------ | ---------------------- |
| **语言**     | 🇨🇳 中文             | 🇺🇸 英文                 |
| **来源**     | 东方财富、财联社等 | Yahoo Finance、Reuters |
| **A股覆盖**  | ⭐⭐⭐ 优秀           | ⭐ 较弱                 |
| **港股覆盖** | ⭐⭐⭐ 优秀           | ⭐⭐ 尚可                |
| **时效性**   | 实时               | 1-2天延迟              |
| **适用场景** | 主方案             | 国际视角补充           |

### 使用建议

- **主方案**：东财 API（中文、实时、覆盖全）
- **补充方案**：yfinance（获取国际投行观点、英文研报摘要）

---

## 其他数据源参考

| 来源         | 类型     | A股 | 港股 | 个股新闻 | 备注     |
| ------------ | -------- | --- | ---- | -------- | -------- |
| **东财 API** | 直连     | ✅   | ✅    | ✅        | ⭐ 推荐   |
| **yfinance** | Python包 | ⚠️   | ✅    | ✅        | 英文为主 |
| Tushare      | Python包 | ✅   | ⚠️    | ✅        | 积分制   |
| Baostock     | Python包 | ✅   | ❌    | ❌        | 无新闻   |
| NewsAPI      | API      | ✅   | ✅    | ⚠️        | 20次/天  |
| EODHD        | API      | ✅   | ✅    | ✅        | 20次/天  |
