from fastapi import APIRouter, Depends
from ..database import get_db
from ..security import get_current_user_payload
from ..incident import incident_responder

router = APIRouter(prefix="/api/v1/system", tags=["System Health & Incident Response"])

@router.get("/health")
def get_health_status():
    return incident_responder.get_system_health()

@router.get("/audit")
def get_audit_trail(user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    with get_db() as db:
        logs = db.execute(
            "SELECT * FROM audit_logs WHERE user_id = ? OR user_id IS NULL ORDER BY timestamp DESC LIMIT 30",
            (user_id,)
        ).fetchall()
        return [dict(l) for l in logs]
