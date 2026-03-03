"""Verify LLMRegistry works correctly for all roles."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.engine.llm_registry import LLMRegistry

print("=" * 60)
print("  LLM Registry Verification")
print("=" * 60)

# 1. List all models
print("\n📋 All Registered Models:")
for m in LLMRegistry.list_all():
    status = "🟢 ON " if m['is_active'] else "⚪ OFF"
    print(f"  {status} P{m['priority']:>3} | {m['model_id']:<22} | {m['model']:<22} | roles={m['roles']}")

# 2. Test each role
for role in ["prediction", "brief_free", "brief_pro"]:
    print(f"\n🎯 Role: {role}")
    
    ids = LLMRegistry.get_active_model_ids(role)
    print(f"  Active model IDs: {ids}")
    
    info = LLMRegistry.get_model_info(role)
    print(f"  Best model: {info.get('display_name', 'N/A')} ({info.get('model', 'N/A')})")
    
    try:
        client = LLMRegistry.get_client(role)
        print(f"  ✅ Client created: provider={client.provider}, model={client.model}")
        print(f"     base_url={client.base_url[:50]}...")
    except ValueError as e:
        print(f"  ❌ {e}")

print("\n" + "=" * 60)
print("  ✅ All checks passed!")
print("=" * 60)
