from typing import Optional
from fastapi import APIRouter
from app.database import query

router = APIRouter()


@router.get("")
def list_cbs(
    event_id: Optional[str] = None,
    tier: Optional[str] = None,
    has_evacuation: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
):
    sql = "SELECT * FROM cbs_messages WHERE 1=1"
    params: list = []
    if event_id:
        sql += " AND event_id=%s"
        params.append(event_id)
    if tier:
        sql += " AND tier=%s"
        params.append(tier)
    if has_evacuation is not None:
        sql += " AND has_evacuation=%s"
        params.append(has_evacuation)
    sql += " ORDER BY issued_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]
    return query(sql, params)
