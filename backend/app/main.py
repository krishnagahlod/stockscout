from fastapi import FastAPI, Depends, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.services.scoring_service import generate_scores
import os
from dotenv import load_dotenv

load_dotenv()

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from contextlib import asynccontextmanager
from app.services.scheduler_service import start_scheduler
from app.core.database import async_session, get_db
from app.services.data_service import get_stock_count, sync_universe_from_csv
from sqlalchemy.ext.asyncio import AsyncSession

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import create_tables
    await create_tables()
    start_scheduler()
    # Initial seed if database is empty
    try:
        async with async_session() as db:
            count = await get_stock_count(db)
            if count == 0:
                logger.info("Database is empty, running initial universe sync...")
                await sync_universe_from_csv(db)
            else:
                from app.services.data_service import get_last_sync_time
                from datetime import datetime, timedelta
                last_sync = await get_last_sync_time(db, "daily_price_sync")
                should_sync = True
                if last_sync:
                    last_time = datetime.fromisoformat(last_sync)
                    # Use naive datetime if ISO format doesn't contain timezone info, or make it timezone aware
                    if last_time.tzinfo:
                        now = datetime.now(last_time.tzinfo)
                    else:
                        now = datetime.now()
                        
                    if (now - last_time) < timedelta(hours=12):
                        should_sync = False
                
                if should_sync:
                    logger.info("Data is stale (>12 hours or no sync log). Triggering background full sync...")
                    import asyncio
                    from scripts.sync_all import sync_everything
                    asyncio.create_task(sync_everything())
                else:
                    logger.info("Data is fresh. Skipping startup background sync.")
    except Exception as e:
        logger.error(f"Failed initial database seed or startup check: {e}")
    yield

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="StockScout API v2", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stockscout_api")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.4f}s")
    return response
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_SECRET_KEY = os.environ.get("API_SECRET_KEY", "dev_shared_secret_key")

@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path in ["/", "/health", "/api/health", "/docs", "/openapi.json"]:
        return await call_next(request)
    
    token = request.headers.get("X-API-Key")
    if token != API_SECRET_KEY:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        
    return await call_next(request)

def verify_token(req: Request):
    token = req.headers.get("Authorization")
    if not token or token != f"Bearer {os.environ.get('API_SECRET_KEY', 'dev_shared_secret_key')}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return token

from app.api.sync import router as sync_router
from app.routers.llm import router as llm_router
from app.routers.backtest import router as backtest_router
from app.routers.strategies import router as strategies_router
from app.routers.portfolio import router as portfolio_router

from app.routers.health import router as health_router
from app.routers.dashboard import router as dashboard_router
from app.routers.data_pipeline import router as data_router
from app.routers.alerts import router as alerts_router
from app.routers.scheduler import router as scheduler_router
from app.routers.features import router as features_router

app.include_router(sync_router, prefix="/api", tags=["sync"])
app.include_router(llm_router, prefix="/api", tags=["LLM"])
app.include_router(backtest_router, prefix="/api", tags=["Backtest"])
app.include_router(strategies_router, prefix="/api", tags=["Strategies"])
app.include_router(portfolio_router, prefix="/api", tags=["Portfolio"])

app.include_router(health_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(data_router, prefix="/api")
app.include_router(alerts_router, prefix="/api", tags=["alerts"])
app.include_router(scheduler_router, prefix="/api")
from app.routers.screener import router as screener_router
from app.routers.stocks import router as stocks_router
from app.routers.playbook import router as playbook_router
from app.routers.monitor import router as monitor_router
from app.routers.rebalance import router as rebalance_router
from app.routers.brokers import router as brokers_router
app.include_router(screener_router, prefix="/api")
app.include_router(stocks_router, prefix="/api")
app.include_router(playbook_router, prefix="/api", tags=["Playbook"])
app.include_router(monitor_router, prefix="/api", tags=["Monitor"])
app.include_router(rebalance_router, prefix="/api", tags=["Rebalance & Attribution"])
app.include_router(brokers_router, prefix="/api/brokers", tags=["Brokers"])
@app.post("/compute/score", dependencies=[Depends(verify_token)])


async def compute_scores(user_id: str, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    background_tasks.add_task(generate_scores, db, user_id)
    return {"status": "processing", "message": "Scoring initiated in the background."}

@app.get("/compute/score")
async def get_single_score(user_id: str, stock_id: int):
    # Dummy score for check stock page
    import random
    score = random.randint(60, 95)
    return {
        "id": stock_id,
        "fundamentals_score": score - random.randint(0, 10),
        "sector_score": score - random.randint(0, 10),
        "news_score": score - random.randint(0, 10),
        "combined_score": score,
        "risk_band": random.choice(["conservative", "moderate", "aggressive"]),
        "score_breakdown": {"valuation": "Good", "growth": "Average"}
    }

@app.get("/compute/scores/top")
async def get_top_scores(user_id: str = "default_user", db: AsyncSession = Depends(get_db)):
    import os, json
    
    file_path = f"data/{user_id}_picks.json"
    
    if not os.path.exists(file_path):
        from app.services.scoring_service import generate_scores
        await generate_scores(db, user_id)
        
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            return json.load(f)
            
    return []


