from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import json

@dataclass
class ChainContext:
    """
    Manages the state of a multi-turn LLM chain execution.
    Features 'Context Compression' to help weak models focus.
    """
    symbol: str
    date: str
    input_data: Dict[str, Any]
    
    # --- Conversation State ---
    # raw_messages: Complete debug history
    raw_messages: List[Dict[str, str]] = field(default_factory=list)
    
    # structured_memory: Instead of raw history, we store distilled insights 
    # from previous steps to feed into future steps.
    # This mitigates "Context Dilution" for small models.
    structured_memory: Dict[str, str] = field(default_factory=lambda: {
        "anchor_summary": "",    # Step 1 output (Data confirmed)
        "technical_insight": "", # Step 2 output (Indicators analyzed)
        "period_insight": "",    # Step 3 output (Trend confirmed)
    })
    
    # artifacts: Final structured outputs
    artifacts: Dict[str, Any] = field(default_factory=lambda: {
        "anchor": None,
        "indicator": None,
        "multi_period": None,
        "synthesis": None
    })
    
    total_tokens: int = 0
    step_durations: List[Dict[str, int]] = field(default_factory=list)

    def add_message(self, role: str, content: str):
        """Log raw message for debugging/tracing."""
        self.raw_messages.append({"role": role, "content": content})

    def get_optimized_history(self, current_step: str) -> List[Dict[str, str]]:
        """
        Constructs a concise context tailored for the current step.
        Avoids dumping full history to weak models.
        """
        # Base context is always the system persona (handled by BaseStep builder)
        messages = []
        
        # Collaborative Memory Construction
        if current_step == "indicator":
            # Step 2 needs: Step 1's data anchor confirmation
            if self.structured_memory["anchor_summary"]:
                messages.append({"role": "user", "content": f"Previous Data Check Results:\n{self.structured_memory['anchor_summary']}"})
                
        elif current_step == "multi_period":
            # Step 3 needs: Step 2's technical analysis
            if self.structured_memory["technical_insight"]:
                 messages.append({"role": "user", "content": f"Daily Technical Analysis Summary:\n{self.structured_memory['technical_insight']}"})

        elif current_step == "synthesis":
            # Step 4 needs: EVERYTHING (but summarized)
            summary = "Prior Analysis Context:\n"
            summary += f"1. Data: {self.structured_memory.get('anchor_summary', 'OK')}\n"
            summary += f"2. D1 Tech: {self.structured_memory.get('technical_insight', 'N/A')}\n"
            summary += f"3. W1/M1 Tech: {self.structured_memory.get('period_insight', 'N/A')}\n"
            
            messages.append({"role": "user", "content": summary})
            
        return messages
