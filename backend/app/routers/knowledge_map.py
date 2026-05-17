import math
from fastapi import APIRouter, HTTPException
from app.database import query

router = APIRouter()


TYPE_COLOR = {
    "event": "#e03838",
    "disaster_type": "#22b0d8",
    "region": "#28c870",
    "datasource": "#8855d8",
}


def _safe_log(n: int) -> float:
    return math.log(n + 1) * 5


@router.get("")
def knowledge_map():
    events = query(
        """SELECT e.event_id, e.name, e.year, e.disaster_type, e.regions,
                  e.deaths, e.missing, e.special_disaster,
                  COALESCE(s.cbs_total, 0) AS cbs_total,
                  COALESCE(s.cbs_tier1, 0) AS cbs_tier1,
                  COALESCE(s.deif_alerts, 0) AS deif_alerts,
                  COALESCE(s.warning_count, 0) AS warning_count
           FROM events e
           LEFT JOIN v_event_summary s ON s.event_id = e.event_id
           ORDER BY e.started_at"""
    )

    types_seen: dict[str, int] = {}
    regions_seen: dict[str, int] = {}
    for ev in events:
        t = ev["disaster_type"]
        types_seen[t] = types_seen.get(t, 0) + 1
        for r in (ev["regions"] or []):
            regions_seen[r] = regions_seen.get(r, 0) + 1

    nodes = []
    links = []

    for ev in events:
        nodes.append({
            "id": ev["event_id"],
            "type": "event",
            "label": ev["name"],
            "size": (ev["deaths"] or 0) * 3 + (ev["missing"] or 0) * 3 + 10,
            "color": TYPE_COLOR["event"],
            "year": ev["year"],
            "disaster_type": ev["disaster_type"],
            "special": ev["special_disaster"],
            "deaths": ev["deaths"],
            "missing": ev["missing"],
        })
        type_node = f"type_{ev['disaster_type']}"
        links.append({"source": ev["event_id"], "target": type_node, "value": 1, "kind": "event-type"})
        for r in (ev["regions"] or []):
            region_node = f"region_{r}"
            links.append({"source": ev["event_id"], "target": region_node, "value": 1, "kind": "event-region"})
        if ev["cbs_tier1"]:
            links.append({"source": ev["event_id"], "target": "src_cbs", "value": ev["cbs_tier1"], "kind": "event-cbs"})
        if ev["deif_alerts"]:
            links.append({"source": ev["event_id"], "target": "src_deif", "value": ev["deif_alerts"], "kind": "event-deif"})
        if ev["warning_count"]:
            links.append({"source": ev["event_id"], "target": "src_warn", "value": ev["warning_count"], "kind": "event-warning"})

    for t, c in types_seen.items():
        nodes.append({
            "id": f"type_{t}",
            "type": "disaster_type",
            "label": t,
            "size": c * 4 + 12,
            "color": TYPE_COLOR["disaster_type"],
            "count": c,
        })

    for r, c in regions_seen.items():
        nodes.append({
            "id": f"region_{r}",
            "type": "region",
            "label": r,
            "size": c * 3 + 10,
            "color": TYPE_COLOR["region"],
            "count": c,
        })

    counts = {
        "src_cbs": query("SELECT COUNT(*) AS c FROM cbs_messages")[0]["c"],
        "src_warn": query("SELECT COUNT(*) AS c FROM weather_warnings")[0]["c"],
        "src_vuln": query("SELECT COUNT(*) AS c FROM vulnerability_zones")[0]["c"],
        "src_deif": query("SELECT COUNT(*) AS c FROM deif_alerts")[0]["c"],
    }
    labels = {
        "src_cbs": f"CBS 재난문자\n{counts['src_cbs']:,}건",
        "src_warn": f"기상특보\n{counts['src_warn']:,}건",
        "src_vuln": f"취약지역\n{counts['src_vuln']:,}건",
        "src_deif": f"DEIF 알림\n{counts['src_deif']:,}건",
    }
    for sid, label in labels.items():
        nodes.append({
            "id": sid,
            "type": "datasource",
            "label": label,
            "size": _safe_log(counts[sid]) + 14,
            "color": TYPE_COLOR["datasource"],
            "count": counts[sid],
        })

    valid = {n["id"] for n in nodes}
    links = [l for l in links if l["source"] in valid and l["target"] in valid]

    return {"nodes": nodes, "links": links}


@router.get("/event/{event_id}")
def event_subgraph(event_id: str):
    ev_rows = query(
        """SELECT e.event_id, e.name, e.year, e.disaster_type, e.regions,
                  e.deaths, e.missing, e.special_disaster
           FROM events e WHERE event_id=%s""",
        (event_id,),
    )
    if not ev_rows:
        raise HTTPException(404, "event not found")
    ev = ev_rows[0]

    cbs_n = query("SELECT COUNT(*) AS c FROM cbs_messages WHERE event_id=%s", (event_id,))[0]["c"]
    warn_n = query("SELECT COUNT(*) AS c FROM weather_warnings WHERE event_id=%s", (event_id,))[0]["c"]
    deif_n = query("SELECT COUNT(*) AS c FROM deif_alerts WHERE event_id=%s", (event_id,))[0]["c"]

    nodes = [{
        "id": ev["event_id"],
        "type": "event",
        "label": ev["name"],
        "size": (ev["deaths"] or 0) * 3 + 20,
        "color": TYPE_COLOR["event"],
    }]
    links = []

    nodes.append({"id": f"type_{ev['disaster_type']}", "type": "disaster_type",
                  "label": ev["disaster_type"], "size": 18, "color": TYPE_COLOR["disaster_type"]})
    links.append({"source": ev["event_id"], "target": f"type_{ev['disaster_type']}", "value": 1, "kind": "event-type"})

    for r in (ev["regions"] or []):
        nodes.append({"id": f"region_{r}", "type": "region", "label": r, "size": 16, "color": TYPE_COLOR["region"]})
        links.append({"source": ev["event_id"], "target": f"region_{r}", "value": 1, "kind": "event-region"})

    for sid, label, n in [
        ("src_cbs", f"CBS\n{cbs_n:,}건", cbs_n),
        ("src_warn", f"기상특보\n{warn_n:,}건", warn_n),
        ("src_deif", f"DEIF\n{deif_n:,}건", deif_n),
    ]:
        if n > 0:
            nodes.append({"id": sid, "type": "datasource", "label": label,
                          "size": _safe_log(n) + 14, "color": TYPE_COLOR["datasource"], "count": n})
            links.append({"source": ev["event_id"], "target": sid, "value": n, "kind": f"event-{sid[4:]}"})

    return {"nodes": nodes, "links": links}
