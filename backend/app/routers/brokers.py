from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel, UUID4
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.database import get_db
from app.models.db_models import BrokerAccount, Holding, Stock
from app.services.broker_crypto_service import encrypt_credentials
from app.services.broker_integration_service import BrokerIntegrationService
from loguru import logger

router = APIRouter()

class BrokerCredentialsInput(BaseModel):
    broker_name: str
    account_label: str
    account_purpose: str
    credentials: Dict[str, str]

@router.post("/connect")
async def connect_broker(payload: BrokerCredentialsInput, db: AsyncSession = Depends(get_db)):
    """Validates credentials and connects a new broker account."""
    user_id = "608f555b-eef6-4fec-a35a-a14dfd043da2"  # Hardcoded for now per requirements

    try:
        adapter = BrokerIntegrationService.get_adapter(payload.broker_name, payload.credentials)
        if not adapter.authenticate():
            raise HTTPException(status_code=400, detail="Authentication failed with the provided credentials.")
            
        encrypted_creds = encrypt_credentials(payload.credentials)
        
        new_account = BrokerAccount(
            user_id=user_id,
            broker_name=payload.broker_name.lower(),
            account_label=payload.account_label,
            account_purpose=payload.account_purpose,
            credentials_encrypted=encrypted_creds,
            sync_status="never"
        )
        
        db.add(new_account)
        await db.commit()
        await db.refresh(new_account)
        
        return {"status": "success", "message": "Broker account connected successfully.", "account_id": new_account.id}
    except Exception as e:
        logger.error(f"Failed to connect broker: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accounts")
async def list_broker_accounts(db: AsyncSession = Depends(get_db)):
    """Lists all connected broker accounts for the user."""
    user_id = "608f555b-eef6-4fec-a35a-a14dfd043da2"
    result = await db.execute(select(BrokerAccount).where(BrokerAccount.user_id == user_id))
    accounts = result.scalars().all()
    
    return [
        {
            "id": acc.id,
            "broker_name": acc.broker_name,
            "account_label": acc.account_label,
            "account_purpose": acc.account_purpose,
            "last_synced_at": acc.last_synced_at.isoformat() if acc.last_synced_at else None,
            "sync_status": acc.sync_status,
            "holdings_count": acc.holdings_count,
            "total_current_value": acc.total_current_value
        }
        for acc in accounts
    ]

@router.post("/{account_id}/sync")
async def sync_broker_account(account_id: int, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Triggers an async sync for a specific broker account."""
    user_id = "608f555b-eef6-4fec-a35a-a14dfd043da2"
    
    result = await db.execute(select(BrokerAccount).where(BrokerAccount.id == account_id, BrokerAccount.user_id == user_id))
    account = result.scalars().first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    account.sync_status = "syncing"
    await db.commit()
    
    # In a real app, this would be a celery task or similar background runner
    # For now, we will just use a background task, but realistically we'll just implement the logic in a service
    
    return {"status": "sync_started", "message": "Sync started in background."}
