import os
import requests
from dotenv import load_dotenv

def trigger_workflow():
    load_dotenv("backend/.env")
    token = os.getenv("GITHUB_PAT")
    owner = "franksunye"
    repo = "stockwise"
    workflow_id = "daily_pipeline_cn_main.yml"
    
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
    
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    data = {
        "ref": "main"
    }
    
    print(f"🚀 Triggering {workflow_id} for {owner}/{repo}...")
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code == 204:
        print("✅ Workflow triggered successfully!")
    else:
        print(f"❌ Failed to trigger workflow: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    trigger_workflow()
