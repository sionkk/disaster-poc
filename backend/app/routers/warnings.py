from typing import Optional
from fastapi import APIRouter
from app.database import query

router = APIRouter()


@router.get("")
def list_warnings(
    event_id: Optional[str] = None,
    warning_level: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
):
    sql = "SELECT * FROM weather_warnings WHERE 1=1"
    params: list = []
    if event_id:
        sql += " AND event_id=%s"
        params.append(event_id)
    if warning_level:
        sql += " AND warning_level=%s"
        params.append(warning_level)
    sql += " ORDER BY issued_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]
    return query(sql, params)
