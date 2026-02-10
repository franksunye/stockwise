"""
Migration: Seed roles for existing prediction_models.
This is a one-time migration to assign roles to all models in the DB.
"""
import json
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_connection

# Role assignments based on current system usage
ROLE_SEED = {
    # Active prediction models
    "deepseek-v3.2-exp": ["prediction", "brief_pro"],
    "rule-engine":       ["prediction"],
    "gemini-3-flash":    ["prediction"],
    "hunyuan-lite":      ["prediction", "brief_free"],
    
    # Inactive / legacy models (assign roles for future re-activation)
    "deepseek-aliyun":   ["prediction", "brief_pro"],
    "deepseek-v3":       ["prediction"],
    "legacy-ai":         [],
    "mock-dev":          [],
}

def migrate():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Ensure roles column exists
    try:
        cursor.execute("ALTER TABLE prediction_models ADD COLUMN roles TEXT")
        print("✅ Added 'roles' column to prediction_models")
    except Exception as e:
        if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
            print("ℹ️  'roles' column already exists")
        else:
            print(f"⚠️  Column check: {e}")
    
    # 2. Seed roles
    for model_id, roles in ROLE_SEED.items():
        roles_json = json.dumps(roles)
        cursor.execute(
            "UPDATE prediction_models SET roles = ? WHERE model_id = ?",
            (roles_json, model_id)
        )
        affected = cursor.rowcount
        status = "✅" if affected > 0 else "⏭️ (not found)"
        print(f"  {status} {model_id}: {roles}")
    
    conn.commit()
    conn.close()
    print("\n🎉 Migration complete!")
    
    # 3. Verify
    print("\n--- Verification ---")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT model_id, display_name, is_active, priority, roles FROM prediction_models ORDER BY priority DESC")
    cols = [d[0] for d in cursor.description]
    for row in cursor.fetchall():
        r = dict(zip(cols, row))
        active = "🟢" if r['is_active'] else "⚪"
        print(f"  {active} P{r['priority']:>3} | {r['model_id']:<22} | {r['display_name']:<28} | roles={r['roles']}")
    conn.close()

if __name__ == "__main__":
    migrate()
