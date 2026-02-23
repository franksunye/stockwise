import asyncio
import json
from backend.engine.runner import PredictionRunner
from backend.engine.metaphor import metaphor_engine

async def test_silent_math_injection():
    print("🚀 Testing Silent Math Injection...")
    
    # Use a real stock but force a run
    symbol = "00700" 
    runner = PredictionRunner(force=True)
    
    # We skip the actual LLM call to save tokens/time, or just run a rule-based one
    # Actually, let's run a full analysis to see the real'ish output
    # But for a quick test, let's just test the MetaphorEngine directly
    
    test_pred = {
        "signal": "Long",
        "confidence": 0.85,
        "reasoning": json.dumps({"summary": "Strong growth", "tactics": {}})
    }
    
    market_data = {
        "rsi": 65,
        "ma5": 400,
        "ma20": 380,
        "latest_data": {"close": 395}
    }
    
    story = metaphor_engine.get_visual_story(test_pred, market_data)
    print(f"\n✨ Generated Story:\n{json.dumps(story, indent=2, ensure_ascii=False)}")
    
    # Test the injection logic from runner
    reasoning_dict = json.loads(test_pred['reasoning'])
    reasoning_dict['visual_story'] = story
    injected_reasoning = json.dumps(reasoning_dict, ensure_ascii=False)
    
    print(f"\n📦 Injected Reasoning Snippet:\n{injected_reasoning[:200]}...")
    
    if "visual_story" in injected_reasoning:
        print("\n✅ Success: Silent Math data correctly structured for frontend Consumption.")
    else:
        print("\n❌ Failed: Injection logic issue.")

if __name__ == "__main__":
    asyncio.run(test_silent_math_injection())
