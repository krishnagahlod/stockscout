import os
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from openai import OpenAI
from app.utils.vocabulary_guard import apply_vocabulary_guard

router = APIRouter()

client = OpenAI(
    base_url="https://api.cerebras.ai/v1",
    api_key=os.environ.get("CEREBRAS_API_KEY", "dummy"),
)
MODEL_NAME = "gpt-oss-120b"

# --- Models ---
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    finalize: bool = False

class ParseStrategyRequest(BaseModel):
    prompt: str

class GenerateThesisRequest(BaseModel):
    strategy_id: Optional[int] = None
    rules_json: Optional[str] = None

class FilterCondition(BaseModel):
    metric: str
    op: str
    value: Any

class StrategyRules(BaseModel):
    name: str
    universe: Optional[str] = "nifty500"
    filters: List[FilterCondition]
    ranking: Optional[Dict[str, str]] = None
    selection: Optional[Dict[str, int]] = None

class ExplainRulesRequest(BaseModel):
    rules: StrategyRules

class QuickPreviewRequest(BaseModel):
    rules: StrategyRules

class ExplainStockRequest(BaseModel):
    symbol: str
    strategy_id: Optional[int] = None

# --- Endpoints ---

@router.get("/status")
def get_llm_status():
    has_key = bool(os.environ.get("CEREBRAS_API_KEY"))
    return {
        "ollama_running": has_key,
        "model_available": has_key,
        "model": MODEL_NAME,
        "error": None if has_key else "Missing CEREBRAS_API_KEY in backend .env"
    }

@router.post("/chat")
def strategy_chat(req: ChatRequest):
    if not os.environ.get("CEREBRAS_API_KEY"):
        raise HTTPException(status_code=500, detail="Missing CEREBRAS_API_KEY")

    system_prompt = f"""You are StockScout, an AI assistant helping a user build a stock screening strategy.
Your goal is to help them formulate filters based on their ideas.
When you output text, do NOT use words like "buy", "sell", "recommend", "best stock", or "guaranteed".
Instead use phrases like "consider", "re-evaluate", "highlight", "strong match".
If the user has finalized their criteria, or you think they are ready, output a JSON block at the very end of your thought process wrapped in ```json.
The JSON must map to this structure:
{{
  "name": "A catchy name for the strategy",
  "universe": "nifty500",
  "filters": [{{ "metric": "pe", "op": "<", "value": 20 }}],
  "ranking": {{ "metric": "market_cap", "order": "desc" }},
  "selection": {{ "top_n": 30 }}
}}
Valid metrics: market_cap, pe, pb, roe, roce, debt_to_equity, dividend_yield, eps_growth_1yr, revenue_growth_1yr, operating_margin, net_profit_margin, current_ratio, rsi_14, macd, macd_signal, macd_hist, sma_20, sma_50, sma_200, momentum_1m, momentum_3m, momentum_6m, momentum_12m, volatility_30d.
If the user hasn't finalized, just reply nicely and ask clarifying questions. If finalize={req.finalize}, YOU MUST INCLUDE THE JSON BLOCK."""

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend([{"role": m.role, "content": m.content} for m in req.messages])

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=0.7,
            max_tokens=1500
        )
        content = response.choices[0].message.content
        content = apply_vocabulary_guard(content)

        strategy_rules = None
        partial_rules = None

        import re
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
        if json_match:
            try:
                parsed = json.loads(json_match.group(1))
                if req.finalize:
                    strategy_rules = parsed
                else:
                    partial_rules = parsed
                content = content.replace(json_match.group(0), "").strip()
            except Exception as e:
                print("Failed to parse JSON", e)

        return {
            "role": "assistant",
            "content": content,
            "strategy_rules": strategy_rules,
            "partial_rules": partial_rules
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/parse-strategy")
def parse_strategy(req: ParseStrategyRequest):
    prompt = f"Convert this text into a strategy rules JSON object: {req.prompt}"
    # Minimal implementation for now
    return {"rules": {"name": "AI Strategy", "filters": []}, "rules_json": "{}"}

@router.post("/generate-thesis")
def generate_thesis(req: GenerateThesisRequest):
    prompt = f"Generate an investment thesis based on these strategy rules: {req.rules_json}"
    
    system = "You are an expert investment analyst. Provide a thesis. Output strictly valid JSON matching { summary: str, key_points: List[str], risks: List[{factor, severity, description}], recommendation: str }."
    
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        content = apply_vocabulary_guard(response.choices[0].message.content)
        return json.loads(content)
    except:
        return {
            "summary": "AI generated thesis based on the strategy rules.",
            "key_points": ["Focuses on fundamentals", "Emphasizes risk management"],
            "risks": [{"factor": "Market Risk", "severity": "Medium", "description": "General market downturns"}],
            "recommendation": "The strategy highlights interesting opportunities."
        }

@router.post("/explain-rules")
def explain_rules(req: ExplainRulesRequest):
    return {
        "strategy_summary": "This strategy targets stocks with your specific criteria.",
        "filter_explanations": [{"metric": f.metric, "op": f.op, "value": f.value, "explanation": "Filters based on this metric"} for f in req.rules.filters],
        "ranking_explanation": "Ranks stocks based on the chosen metric.",
        "suitability": "Suitable for investors looking for these factors."
    }

@router.post("/quick-preview")
def quick_preview(req: QuickPreviewRequest):
    return {
        "match_count": 0,
        "top_stocks": [],
        "total_universe": 500
    }

@router.post("/explain-stock")
def explain_stock(req: ExplainStockRequest):
    return {
        "symbol": req.symbol,
        "reasons": ["Meets criteria"],
        "strengths": ["Strong fundamentals"],
        "concerns": ["Market volatility"],
        "overall": "A strong match for the strategy."
    }
