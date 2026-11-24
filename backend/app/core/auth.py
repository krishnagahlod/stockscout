import os
import uuid

from fastapi import Header, HTTPException, Request


def current_user_id(x_user_id: str | None = Header(None)) -> uuid.UUID:
    """Signed-in user's id, set by the Next.js middleware/server actions after Supabase verifies the session.

    Only trusted because every request must also carry the shared X-API-Key, which browsers never see.
    """
    try:
        return uuid.UUID(x_user_id or "")  # Supabase user ids are UUIDs; DB columns are UUID-typed
    except ValueError:
        raise HTTPException(status_code=401, detail="Not signed in")


def admin_for_writes(request: Request, x_user_id: str | None = Header(None)) -> None:
    """Anyone signed in may read; only ADMIN_USER_IDS may trigger syncs, recomputes or scheduler changes."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    admins = {a.strip() for a in os.getenv("ADMIN_USER_IDS", "").split(",") if a.strip()}
    if str(current_user_id(x_user_id)) not in admins:
        raise HTTPException(status_code=403, detail="Admins only")
