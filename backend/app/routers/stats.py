from fastapi import APIRouter
from app.database import query

router = APIRouter()


@router.get("/summary")
def summary():
    rows = query(
        """
        SELECT
          (SELECT COUNT(*) FROM events)                                     AS total_events,
          (SELECT COALESCE(SUM(deaths),0) FROM events)                      AS total_deaths,
          (SELECT COALESCE(SUM(missing),0) FROM events)                     AS total_missing,
          (SELECT COUNT(*) FROM cbs_messages)                               AS total_cbs,
          (SELECT COUNT(*) FROM cbs_messages WHERE tier='TIER1_핵심재난')   AS total_cbs_tier1,
          (SELECT COUNT(*) FROM cbs_messages WHERE has_evacuation)          AS total_cbs_evacuation,
          (SELECT COALESCE(SUM(property_bil),0) FROM events)                AS total_property_bil,
          (SELECT COUNT(*) FROM events WHERE special_disaster)              AS special_disaster_count,
          (SELECT COUNT(*) FROM deif_alerts)                                AS total_deif_alerts,
          (SELECT COUNT(*) FROM deif_alerts WHERE severity='CRITICAL')      AS deif_critical
        """
    )
    return rows[0] if rows else {}


@router.get("/by-year")
def by_year():
    return query(
        """
        SELECT
          e.year,
          COUNT(*)                       AS event_count,
          COALESCE(SUM(e.deaths),0)      AS deaths,
          COALESCE(SUM(e.missing),0)     AS missing,
          COALESCE(SUM(e.property_bil),0) AS property_bil,
          (SELECT COUNT(*) FROM cbs_messages c
             JOIN events e2 ON e2.event_id=c.event_id
             WHERE e2.year=e.year AND c.tier='TIER1_핵심재난') AS cbs_tier1
        FROM events e
        GROUP BY e.year
        ORDER BY e.year
        """
    )


@router.get("/by-type")
def by_type():
    return query(
        """
        SELECT
          disaster_type,
          COUNT(*)                       AS event_count,
          COALESCE(SUM(deaths),0)        AS deaths,
          COALESCE(SUM(missing),0)       AS missing,
          COALESCE(SUM(property_bil),0)  AS property_bil
        FROM events
        GROUP BY disaster_type
        ORDER BY property_bil DESC
        """
    )


@router.get("/cbs-by-event")
def cbs_by_event():
    return query(
        """
        SELECT
          e.event_id,
          e.name,
          e.year,
          COUNT(c.id) FILTER (WHERE c.tier='TIER1_핵심재난') AS cbs_tier1,
          COUNT(c.id)                                         AS cbs_total
        FROM events e
        LEFT JOIN cbs_messages c ON c.event_id=e.event_id
        GROUP BY e.event_id, e.name, e.year
        ORDER BY cbs_tier1 DESC
        LIMIT 20
        """
    )
