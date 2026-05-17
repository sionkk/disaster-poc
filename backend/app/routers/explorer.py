from typing import Optional
from fastapi import APIRouter, Query
from app.database import query

router = APIRouter()


TABLES = [
    ("events", "created_at"),
    ("cbs_messages", "issued_at"),
    ("weather_warnings", "issued_at"),
    ("vulnerability_zones", None),
    ("deif_alerts", "detected_at"),
    ("rainfall_obs", "obs_time"),
]


@router.get("/tables")
def list_tables():
    out = []
    for name, ts_col in TABLES:
        cnt = query(f"SELECT COUNT(*) AS c FROM {name}")[0]["c"]
        last = None
        if ts_col and cnt > 0:
            r = query(f"SELECT MAX({ts_col}) AS t FROM {name}")
            last = r[0]["t"] if r else None
        out.append({"table": name, "count": cnt, "last_loaded": last})
    return out


@router.get("/events")
def explore_events(
    year: Optional[int] = None,
    type: Optional[str] = Query(None),
    special: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "started_at",
    dir: str = "desc",
):
    allowed_sort = {
        "event_id", "year", "name", "disaster_type",
        "started_at", "ended_at", "deaths", "missing", "property_bil",
    }
    if sort not in allowed_sort:
        sort = "started_at"
    direction = "DESC" if dir.lower() == "desc" else "ASC"

    where = "WHERE 1=1"
    params: list = []
    if year is not None:
        where += " AND year=%s"; params.append(year)
    if type:
        where += " AND disaster_type=%s"; params.append(type)
    if special is not None:
        where += " AND special_disaster=%s"; params.append(special)
    if search:
        where += " AND (name ILIKE %s OR event_id ILIKE %s)"
        params += [f"%{search}%", f"%{search}%"]

    total = query(f"SELECT COUNT(*) AS c FROM events {where}", params)[0]["c"]
    rows = query(
        f"SELECT * FROM events {where} ORDER BY {sort} {direction} LIMIT %s OFFSET %s",
        params + [limit, offset],
    )
    return {"total": total, "rows": rows, "limit": limit, "offset": offset}


@router.get("/cbs")
def explore_cbs(
    event_id: Optional[str] = None,
    tier: Optional[str] = None,
    search: Optional[str] = None,
    has_evacuation: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
):
    where = "WHERE 1=1"
    params: list = []
    if event_id:
        where += " AND event_id=%s"; params.append(event_id)
    if tier:
        where += " AND tier=%s"; params.append(tier)
    if has_evacuation is not None:
        where += " AND has_evacuation=%s"; params.append(has_evacuation)
    if search:
        where += " AND content ILIKE %s"; params.append(f"%{search}%")

    total = query(f"SELECT COUNT(*) AS c FROM cbs_messages {where}", params)[0]["c"]
    rows = query(
        f"""SELECT id, event_id, event_name, disaster_type, issued_at, location_name,
                  content, tier, has_evacuation, has_warning, send_platform
            FROM cbs_messages {where}
            ORDER BY issued_at DESC NULLS LAST
            LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )
    return {"total": total, "rows": rows, "limit": limit, "offset": offset}


@router.get("/warnings")
def explore_warnings(
    event_id: Optional[str] = None,
    type: Optional[str] = Query(None),
    level: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    where = "WHERE 1=1"
    params: list = []
    if event_id:
        where += " AND event_id=%s"; params.append(event_id)
    if type:
        where += " AND warning_type ILIKE %s"; params.append(f"%{type}%")
    if level:
        where += " AND warning_level=%s"; params.append(level)

    total = query(f"SELECT COUNT(*) AS c FROM weather_warnings {where}", params)[0]["c"]
    rows = query(
        f"""SELECT id, event_id, issued_at, warning_type, warning_level,
                  region_name, content, source_file
            FROM weather_warnings {where}
            ORDER BY issued_at DESC NULLS LAST
            LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )
    return {"total": total, "rows": rows, "limit": limit, "offset": offset}


@router.get("/vulnerability")
def explore_vulnerability(
    type: Optional[str] = Query(None),
    sido: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    where = "WHERE 1=1"
    params: list = []
    if type:
        where += " AND zone_type=%s"; params.append(type)
    if sido:
        where += " AND region_sido=%s"; params.append(sido)
    if search:
        where += " AND (zone_name ILIKE %s OR address ILIKE %s)"
        params += [f"%{search}%", f"%{search}%"]

    total = query(f"SELECT COUNT(*) AS c FROM vulnerability_zones {where}", params)[0]["c"]
    rows = query(
        f"""SELECT id, zone_type, zone_name, address, region_sido, region_sgg,
                  lat, lon, grade, risk_type, evacuate_place, evacuate_criteria,
                  area_m2, source_file
            FROM vulnerability_zones {where}
            ORDER BY id LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )
    return {"total": total, "rows": rows, "limit": limit, "offset": offset}


@router.get("/deif")
def explore_deif(
    event_id: Optional[str] = None,
    severity: Optional[str] = None,
    rule: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    where = "WHERE 1=1"
    params: list = []
    if event_id:
        where += " AND event_id=%s"; params.append(event_id)
    if severity:
        where += " AND severity=%s"; params.append(severity)
    if rule:
        where += " AND rule_code=%s"; params.append(rule)

    total = query(f"SELECT COUNT(*) AS c FROM deif_alerts {where}", params)[0]["c"]
    rows = query(
        f"""SELECT id, event_id, rule_code, severity, title, detail,
                  delay_minutes, detected_at
            FROM deif_alerts {where}
            ORDER BY severity, rule_code
            LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )
    return {"total": total, "rows": rows, "limit": limit, "offset": offset}


@router.get("/search")
def cross_search(q: str = Query(..., min_length=1), limit: int = 50):
    pat = f"%{q}%"
    results = []

    for row in query(
        """SELECT event_id, name, started_at, disaster_type
           FROM events
           WHERE name ILIKE %s OR event_id ILIKE %s
           ORDER BY started_at DESC LIMIT %s""",
        (pat, pat, limit),
    ):
        results.append({
            "table": "events",
            "id": row["event_id"],
            "event_id": row["event_id"],
            "summary": f"{row['name']} ({row['disaster_type']}, {row['started_at']})",
            "matched_field": "name/event_id",
        })

    for row in query(
        """SELECT id, event_id, location_name, content, issued_at, tier
           FROM cbs_messages
           WHERE content ILIKE %s
           ORDER BY issued_at DESC LIMIT %s""",
        (pat, limit),
    ):
        snippet = (row["content"] or "")[:120]
        results.append({
            "table": "cbs_messages",
            "id": row["id"],
            "event_id": row["event_id"],
            "summary": f"[{row['tier']}] {row['location_name'] or ''} — {snippet}",
            "matched_field": "content",
        })

    for row in query(
        """SELECT id, zone_type, zone_name, address, risk_type
           FROM vulnerability_zones
           WHERE zone_name ILIKE %s OR address ILIKE %s
           LIMIT %s""",
        (pat, pat, limit),
    ):
        results.append({
            "table": "vulnerability_zones",
            "id": row["id"],
            "event_id": None,
            "summary": f"[{row['zone_type']}] {row['zone_name'] or ''} — {row['address'] or ''}",
            "matched_field": "zone_name/address",
        })

    return {"query": q, "count": len(results), "results": results[:limit * 3]}
