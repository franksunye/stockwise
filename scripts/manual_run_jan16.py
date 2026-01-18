import subprocess
import time
import sys
import os

# List of PRO user stocks obtained from database (queried 2026-01-16)
symbols = [
    '001267', '002413', '00700', '01167', '01398', 
    '02171', '300054', '300340', '300395', '300502', 
    '300516', '600879', '601398', '601698', '688017',
    '688041', '688068', '688256'
]

def run_batch():
    total = len(symbols)
    print(f"🚀 Starting batch analysis for {total} stocks...")
    print(f"📅 Date: 2026-01-16")
    print(f"🤖 Model: gemini-3-flash (Local)")

    for i, symbol in enumerate(symbols):
        print(f"\n[{i+1}/{total}] Processing {symbol}...")
        
        cmd = [
            sys.executable, "backend/main.py",
            "--analyze",
            "--symbol", symbol,
            "--force",
            "--model", "gemini-3-flash",
            "--date", "2026-01-16" 
        ]
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Set DB_SOURCE to cloud to enforce writing to production database
                env = os.environ.copy()
                env['DB_SOURCE'] = 'cloud'
                
                # Capture output to check for success message
                # Use --force to ensure we run analysis
                # Need to use 'backend/main.py' relative path
                result = subprocess.run(cmd, capture_output=True, text=True, env=env, encoding='utf-8')
                
                print(result.stdout)
                if result.stderr:
                    print(f"STDERR: {result.stderr}")

                # Check for specific success indicator in output
                if "成功: 1" in result.stdout or "Success: 1" in result.stdout:
                    print(f"✅ Finished {symbol}")
                    break
                else:
                    print(f"⚠️ Attempt {attempt+1}/{max_retries} failed (No success confirmation).")
                    if attempt < max_retries - 1:
                        time.sleep(10) # Wait longer between retries
                    else:
                        print(f"❌ Failed to analyze {symbol} after {max_retries} attempts.")

            except Exception as e:
                print(f"❌ Error executing for {symbol}: {e}")
                time.sleep(5)
            
        if i < total - 1:
            print("⏳ Cooling down for 5 seconds...")
            time.sleep(5)

    print("\n🎉 Batch analysis completed!")

if __name__ == "__main__":
    run_batch()
