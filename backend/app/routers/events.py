from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.database import query

router = APIRouter()


@router.get("")
def list_events(
    year: Optional[int] = None,
    type: Optional[str] = Query(None),
    special: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
):
    sql = "SELECT * FROM v_event_summary WHERE 1=1"
    params: list = []
    if year is not None:
        sql += " AND year=%s"
        params.append(year)
    if type:
        sql += " AND disaster_type=%s"
        params.append(type)
    if special is not None:
        sql += " AND special_disaster=%s"
        params.append(special)
    sql += " ORDER BY started_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]
    return query(sql, params)


@router.get("/{event_id}")
def get_event(event_id: str):
    rows = query("SELECT * FROM v_event_summary WHERE event_id=%s", (event_id,))
    if not rows:
        raise HTTPException(404, "event not found")
    ev = rows[0]
    ev["deif_alerts_list"] = query(
        "SELECT * FROM deif_alerts WHERE event_id=%s ORDER BY severity, rule_code",
        (event_id,),
    )
    cbs_summary = query(
        """
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE tier='TIER1_핵심재난') AS tier1,
          COUNT(*) FILTER (WHERE tier='TIER2_재난관련') AS tier2,
          COUNT(*) FILTER (WHERE has_evacuation) AS evacuation
        FROM cbs_messages WHERE event_id=%s
        """,
        (event_id,),
    )
    ev["cbs_summary"] = cbs_summary[0] if cbs_summary else {}
    return ev


@router.get("/{event_id}/timeline")
def get_timeline(event_id: str):
    rows = query(
        """
        SELECT
          issued_at AS time,
          'warning' AS type,
          NULL::varchar AS tier,
          warning_level AS severity,
          warning_type || ' / ' || COALESCE(warning_level,'') AS title,
          content,
          region_name AS location,
          FALSE AS has_evacuation
        FROM weather_warnings WHERE event_id=%s
        UNION ALL
        SELECT
          issued_at AS time,
          'cbs' AS type,
          tier,
          CASE WHEN has_evacuation THEN 'EVACUATION' ELSE NULL END AS severity,
          COALESCE(disaster_type,'') AS title,
          content,
          location_name AS location,
          has_evacuation
        FROM cbs_messages WHERE event_id=%s
        ORDER BY time NULLS LAST
        """,
        (event_id, event_id),
    )
    ev = query("SELECT * FROM v_event_summary WHERE event_id=%s", (event_id,))
    if not ev:
        raise HTTPException(404, "event not found")
    return {"event": ev[0], "timeline": rows}


@router.get("/{event_id}/cbs")
def get_event_cbs(
    event_id: str,
    tier: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    sql = "SELECT * FROM cbs_messages WHERE event_id=%s"
    params: list = [event_id]
    if tier:
        sql += " AND tier=%s"
        params.append(tier)
    sql += " ORDER BY issued_at LIMIT %s OFFSET %s"
    params += [limit, offset]
    return query(sql, params)


@router.get("/{event_id}/deif")
def get_event_deif(event_id: str):
    return query(
        "SELECT * FROM deif_alerts WHERE event_id=%s ORDER BY severity, rule_code",
        (event_id,),
    )


@router.get("/{event_id}/warnings")
def get_event_warnings(event_id: str):
    return query(
        "SELECT * FROM weather_warnings WHERE event_id=%s ORDER BY issued_at",
        (event_id,),
    )
