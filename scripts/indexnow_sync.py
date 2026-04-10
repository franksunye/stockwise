import requests
import xml.etree.ElementTree as ET
import json
import os

# Configuration
DOMAIN = "www.ziso.cc"
SITEMAP_URL = f"https://{DOMAIN}/sitemap.xml"
INDEXNOW_KEY = "850e0d5d36e246739de77f525672d56a"
INDEXNOW_API = "https://www.bing.com/indexnow"

def fetch_sitemap_urls(url):
    print(f"🔍 Fetching sitemap from: {url}")
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        root = ET.fromstring(response.content)
        # Handle namespaces
        namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        
        urls = []
        for loc in root.findall('.//ns:loc', namespace):
            urls.append(loc.text)
            
        print(f"✅ Found {len(urls)} URLs in sitemap.")
        return urls
    except Exception as e:
        print(f"❌ Error fetching sitemap: {e}")
        return []

def push_to_indexnow(urls):
    if not urls:
        print("⚠️ No URLs to push.")
        return

    print(f"🚀 Pushing {len(urls)} URLs to IndexNow (Bing)...")
    
    payload = {
        "host": DOMAIN,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{DOMAIN}/{INDEXNOW_KEY}.txt",
        "urlList": urls
    }
    
    try:
        response = requests.post(
            INDEXNOW_API,
            headers={"Content-Type": "application/json; charset=utf-8"},
            data=json.dumps(payload),
            timeout=15
        )
        
        if response.status_code == 200:
            print("✨ IndexNow submission successful (HTTP 200)!")
        elif response.status_code == 202:
            print("✨ IndexNow submission accepted (HTTP 202)!")
        else:
            print(f"⚠️ IndexNow submission returned status {response.status_code}: {response.text}")
            
    except Exception as e:
        print(f"❌ Error pushing to IndexNow: {e}")

if __name__ == "__main__":
    urls = fetch_sitemap_urls(SITEMAP_URL)
    push_to_indexnow(urls)
