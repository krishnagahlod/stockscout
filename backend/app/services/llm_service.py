"""LLM integration via Groq for strategy parsing and thesis generation."""

import json
from typing import Optional

from loguru import logger

from app.core.config import settings
from app.models.strategy_schemas import StrategyRules
from app.models.llm_schemas import InvestmentThesis, StockExplanation, ExplainRulesResponse
from app.services.prompt_templates import (
    STRATEGY_PARSE_SYSTEM,
    STRATEGY_PARSE_USER,
    THESIS_SYSTEM,
    THESIS_USER,
    EXPLAIN_STOCK_SYSTEM,
    EXPLAIN_STOCK_USER,
    EXPLAIN_RULES_SYSTEM,
    EXPLAIN_RULES_USER,
    THESIS_FROM_RULES_SYSTEM,
    THESIS_FROM_RULES_USER,
    NEWS_ANALYSIS_SYSTEM,
    NEWS_ANALYSIS_USER,
)


class LLMService:
    """Interface to Cerebras for structured LLM output."""

    def __init__(self):
        self.model = getattr(settings, "CEREBRAS_MODEL", "llama-3.3-70b") or "llama-3.3-70b"
        self.api_key = settings.CEREBRAS_API_KEY

    def _get_client(self):
        from openai import AsyncOpenAI
        if not self.api_key:
            raise RuntimeError(
                "CEREBRAS_API_KEY not set. Add it to backend/.env"
            )
        return AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.cerebras.ai/v1"
        )

    async def _chat(
        self,
        system: str,
        user: str,
        response_format: Optional[dict] = None,
        temperature: float = 0,
    ) -> str:
        """Send a chat request to Cerebras and return the response text."""
        client = self._get_client()

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 1500,
        }

        if response_format:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"Cerebras chat with {self.model} failed: {e}. Retrying with fallback llama3.1-8b...")
            try:
                kwargs["model"] = "llama3.1-8b"
                response = await client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except Exception as fallback_err:
                logger.error(f"Cerebras fallback chat failed: {fallback_err}")
                raise

    async def parse_strategy(self, prompt: str, retries: int = 2) -> StrategyRules:
        """Convert plain-English strategy to structured StrategyRules."""
        user_msg = STRATEGY_PARSE_USER.format(prompt=prompt)

        for attempt in range(retries):
            try:
                response = await self._chat(
                    system=STRATEGY_PARSE_SYSTEM,
                    user=user_msg,
                    response_format={"type": "json_object"},
                    temperature=0,
                )
                parsed = json.loads(response)
                rules = StrategyRules.model_validate(parsed)
                
                # Enforce Factor Orthogonality Warnings
                metrics_used = []
                if rules.ranking and rules.ranking.weights:
                    metrics_used.extend([w.metric for w in rules.ranking.weights])
                metrics_used = list(set(metrics_used))

                correlated_pairs = [
                    ({"trailing_pe", "price_to_book"}, "Trailing PE and Price to Book are both Value factors and highly correlated."),
                    ({"trailing_pe", "ev_to_ebitda"}, "Trailing PE and EV/EBITDA are both Value factors."),
                    ({"roe", "roa"}, "ROE and ROA are both Profitability factors and highly correlated."),
                    ({"gross_margin", "operating_margin"}, "Gross and Operating margins are highly correlated."),
                    ({"volatility_30d", "volatility_90d"}, "30d and 90d volatility are highly correlated."),
                ]
                for pair, warning_msg in correlated_pairs:
                    if pair.issubset(set(metrics_used)):
                        if warning_msg not in rules.warnings:
                            rules.warnings.append(warning_msg)
                
                logger.info(f"Parsed strategy: {rules.name} with {len(rules.filters)} filters")
                return rules
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(f"Parse attempt {attempt + 1} failed: {e}")
                if attempt == retries - 1:
                    raise ValueError(
                        f"Failed to parse strategy after {retries} attempts: {e}"
                    )

        raise ValueError("Failed to parse strategy")

    async def generate_thesis(
        self,
        strategy_name: str,
        rules_summary: str,
        holdings_summary: str,
        metrics_summary: str,
    ) -> InvestmentThesis:
        """Generate an investment thesis for a strategy's portfolio."""
        user_msg = THESIS_USER.format(
            strategy_name=strategy_name,
            rules_summary=rules_summary,
            holdings_summary=holdings_summary,
            metrics_summary=metrics_summary,
        )

        response = await self._chat(
            system=THESIS_SYSTEM,
            user=user_msg,
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        parsed = json.loads(response)
        return InvestmentThesis.model_validate(parsed)

    async def explain_stock(
        self,
        symbol: str,
        name: str,
        sector: str,
        filter_summary: str,
        metric_summary: str,
    ) -> StockExplanation:
        """Explain why a stock was selected by the strategy."""
        user_msg = EXPLAIN_STOCK_USER.format(
            symbol=symbol,
            name=name,
            sector=sector or "Unknown",
            filter_summary=filter_summary,
            metric_summary=metric_summary,
        )

        response = await self._chat(
            system=EXPLAIN_STOCK_SYSTEM,
            user=user_msg,
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        parsed = json.loads(response)
        return StockExplanation.model_validate(parsed)

    async def chat_multi_turn(
        self,
        messages: list[dict],
        json_mode: bool = False,
        temperature: float = 0.3,
    ) -> str:
        """Multi-turn conversation. messages = list of {role, content} dicts."""
        client = self._get_client()

        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 3500,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        logger.info(f"Sending request to Cerebras with model {self.model}")

        try:
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"Cerebras multi-turn chat with {self.model} failed: {e}. Retrying with fallback llama3.1-8b...")
            try:
                kwargs["model"] = "llama3.1-8b"
                response = await client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except Exception as fallback_err:
                logger.error(f"Cerebras fallback multi-turn chat failed: {fallback_err}")
                raise

    async def explain_stock(
        self,
        symbol: str,
        name: str,
        sector: str,
        filter_summary: str,
        metric_summary: str,
    ) -> StockExplanation:
        """Explain why a stock was selected."""
        user_msg = EXPLAIN_STOCK_USER.format(
            symbol=symbol,
            name=name,
            sector=sector,
            filter_summary=filter_summary,
            metric_summary=metric_summary,
        )

        response = await self._chat(
            system=EXPLAIN_STOCK_SYSTEM,
            user=user_msg,
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        parsed = json.loads(response)
        return StockExplanation.model_validate(parsed)

    async def explain_rules(self, rules: dict) -> ExplainRulesResponse:
        """Explain strategy rules in plain English for beginners."""
        # Build text representations of the rules
        filters = rules.get("filters", [])
        filters_text = "\n".join(
            f"- {f.get('metric', '?')} {f.get('op', '>')} {f.get('value', '?')}"
            for f in filters
        )
        ranking = rules.get("ranking", {})
        if ranking and ranking.get("weights"):
            weights_text = ", ".join([f"{w.get('weight', 0)*100}% {w.get('metric', '?')}" for w in ranking.get("weights", [])])
            ranking_text = f"Composite Score ({weights_text})"
        else:
            ranking_text = (
                f"{ranking.get('metric', 'none')} ({ranking.get('order', 'desc')})"
                if ranking else "None"
            )
        selection = rules.get("selection", {})
        rebalance = rules.get("rebalance", {})
        is_custom = rules.get("strategy_type") == "custom"
        top_n = len(rules.get("stocks", [])) if is_custom else selection.get("top_n", 20)

        user_msg = EXPLAIN_RULES_USER.format(
            name=rules.get("name", "Custom Strategy"),
            filters_text=filters_text or "No filters (Custom manual selection)",
            ranking_text=ranking_text if not is_custom else "Manual Stock Picking",
            top_n=top_n,
            rebalance_freq=rebalance.get("frequency", "quarterly"),
        )

        response = await self._chat(
            system=EXPLAIN_RULES_SYSTEM,
            user=user_msg,
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        parsed = json.loads(response)
        return ExplainRulesResponse.model_validate(parsed)

    async def generate_thesis_from_rules(
        self,
        strategy_name: str,
        rules_summary: str,
        stocks_summary: str,
        match_count: int,
    ) -> InvestmentThesis:
        """Generate thesis from rules + screener results (no saved strategy needed)."""
        user_msg = THESIS_FROM_RULES_USER.format(
            strategy_name=strategy_name,
            rules_summary=rules_summary,
            stocks_summary=stocks_summary,
            match_count=match_count,
        )

        response = await self._chat(
            system=THESIS_FROM_RULES_SYSTEM,
            user=user_msg,
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        parsed = json.loads(response)
        return InvestmentThesis.model_validate(parsed)

    async def check_status(self) -> dict:
        """Check if Groq API is accessible."""
        if not self.api_key:
            return {
                "ollama_running": False,
                "error": (
                    "CEREBRAS_API_KEY not set. Add CEREBRAS_API_KEY=csk_... "
                    "to backend/.env"
                ),
            }
        try:
            client = self._get_client()
            models = await client.models.list()
            model_names = [m.id for m in models.data]
            has_model = self.model in model_names
            return {
                "ollama_running": True,  # keep key name for frontend compat
                "model": self.model,
                "model_available": has_model,
                "available_models": model_names[:10],
            }
        except Exception as e:
            return {
                "ollama_running": False,
                "error": f"Cerebras API error: {e}",
            }

    async def analyze_news(self, ticker: str, news_data: list[dict]) -> str:
        """Synthesize recent news items into an AI sentiment analysis."""
        
        # Format the news items into a readable string for the prompt
        formatted_news = "\n".join([
            f"- [{item.get('published_at', '')}] {item.get('title', '')} ({item.get('source', '')})\n  {item.get('summary', '')}" 
            for item in news_data
        ])
        
        user_msg = NEWS_ANALYSIS_USER.format(
            ticker=ticker,
            news_data=formatted_news
        )

        response = await self._chat(
            system=NEWS_ANALYSIS_SYSTEM,
            user=user_msg,
            temperature=0.2,
        )
        return response

# Singleton
llm_service = LLMService()
