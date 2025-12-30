import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import LLM_CONFIG, TURSO_DB_URL

print(f"LLM_API_KEY present: {bool(LLM_CONFIG['api_key'])}")
print(f"LLM_ENABLED: {LLM_CONFIG['enabled']}")
print(f"TURSO_DB_URL present: {bool(TURSO_DB_URL)}")

if not LLM_CONFIG['api_key']:
    print("❌ LLM_API_KEY is missing!")
    sys.exit(1)

if not LLM_CONFIG['enabled']:
    print("❌ LLM_ENABLED is False!")
    sys.exit(1)

print("✅ Env verification passed")
