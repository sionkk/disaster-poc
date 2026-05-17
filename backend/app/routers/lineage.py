from fastapi import APIRouter, HTTPException
from app.database import query

router = APIRouter()


PIPELINE_TEMPLATE = [
    {
        "step": 1,
        "name": "재해연보 PDF",
        "type": "source",
        "desc": "행정안전부 발행 연도별 자연재난 통계집 (2016~2024, 9개 연도)",
        "output_table": "events",
        "files": [
            "2016 재해연보.pdf", "2017 재해연보.pdf", "2018 재해연보.pdf",
            "2019 재해연보.pdf", "2020 재해연보.pdf", "2021 재해연보.pdf",
            "2022 재해연보.pdf", "2023 재해연보.pdf", "2024 재해연보.pdf",
        ],
    },
    {
        "step": 2,
        "name": "CBS 긴급재난문자",
        "type": "source",
        "desc": "행정안전부 재난문자방송 전문 데이터 (2011~2024, 원본 20만건)",
        "output_table": "cbs_messages",
        "files": ["행정안전부_재난문자방송_20111118-20240831.csv"],
        "filter_desc": "사건 기간·지역 매칭 필터 → 11,515건 / 3단계 TIER 분류",
    },
    {
        "step": 3,
        "name": "기상청 특보 통보문",
        "type": "source",
        "desc": "기상청 특보 발효·해제 이력 CSV",
        "output_table": "weather_warnings",
        "files": ["기상청특보통보문.csv", "기상청_특보통보문.csv"],
        "filter_desc": "샘플 100행 — 2016~2024 기간 해당 데이터 부재",
        "next_action": "기상청 공공데이터포털 API 키 등록 후 수집 가능",
    },
    {
        "step": 4,
        "name": "재난 취약지역",
        "type": "source",
        "desc": "산사태·침수흔적·인명피해우려·지역재해위험지구 CSV",
        "output_table": "vulnerability_zones",
        "files": [
            "산사태우려지역.csv",
            "경상남도_산사태취약지역지정현황.csv",
            "행정안전부_침수흔적도.csv",
            "광양시_인명피해우려지역.csv",
            "지역재해위험지구.csv",
        ],
    },
    {
        "step": 5,
        "name": "DEIF 이상탐지",
        "type": "derived",
        "desc": "기상특보-CBS 매칭 기반 자동 생성. CBS 단독 분석(RULE_05·07·08) 포함",
        "output_table": "deif_alerts",
        "files": [],
        "next_action": "기상특보 데이터 확보 시 RULE_01·06 추가 탐지 가능",
    },
    {
        "step": 6,
        "name": "기상청 API 강수량",
        "type": "api",
        "desc": "공공데이터포털 기상청 ASOS·AWS 시간별 강수량 (사건별 수집 예정)",
        "output_table": "rainfall_obs",
        "files": [],
        "next_action": "KMA_API_KEY 환경변수 등록 후 scripts/kma_collector.py 실행",
    },
]


def _status_for(count: int, step_type: str) -> str:
    if count == 0:
        if step_type == "api":
            return "대기 중"
        if step_type == "derived":
            return "완료 (부분)"
        return "미수집"
    return "완료"


@router.get("")
def lineage():
    pipeline = []
    for tmpl in PIPELINE_TEMPLATE:
        tbl = tmpl["output_table"]
        cnt = query(f"SELECT COUNT(*) AS c FROM {tbl}")[0]["c"]
        step = dict(tmpl)
        step["record_count"] = cnt
        step["status"] = _status_for(cnt, tmpl["type"])
        pipeline.append(step)

    source_files = query(
        """SELECT source_file, COUNT(*) AS count, 'vulnerability_zones' AS table_name
           FROM vulnerability_zones
           WHERE source_file IS NOT NULL AND source_file <> ''
           GROUP BY source_file ORDER BY count DESC"""
    )
    source_files += query(
        """SELECT source_file, COUNT(*) AS count, 'weather_warnings' AS table_name
           FROM weather_warnings
           WHERE source_file IS NOT NULL AND source_file <> ''
           GROUP BY source_file ORDER BY count DESC"""
    )

    quality = {
        "vulnerability_zones": query(
            """SELECT COUNT(*) AS total,
                      COUNT(*) FILTER (WHERE lat IS NOT NULL AND lon IS NOT NULL) AS with_coords,
                      COUNT(*) FILTER (WHERE evacuate_place IS NOT NULL AND evacuate_place <> '') AS with_evacuate
               FROM vulnerability_zones"""
        )[0],
        "cbs_messages": query(
            """SELECT
                  COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE tier='TIER1_핵심재난') AS tier1,
                  COUNT(*) FILTER (WHERE tier='TIER2_재난관련') AS tier2,
                  COUNT(*) FILTER (WHERE tier NOT IN ('TIER1_핵심재난','TIER2_재난관련')) AS other,
                  COUNT(*) FILTER (WHERE has_evacuation) AS evacuation,
                  MIN(issued_at) AS earliest,
                  MAX(issued_at) AS latest
               FROM cbs_messages"""
        )[0],
        "events": query(
            """SELECT COUNT(*) AS total,
                      COUNT(*) FILTER (WHERE special_disaster) AS special,
                      MIN(started_at) AS earliest,
                      MAX(ended_at) AS latest
               FROM events"""
        )[0],
        "deif_alerts": query(
            """SELECT COUNT(*) AS total,
                      COUNT(*) FILTER (WHERE severity='CRITICAL') AS critical,
                      COUNT(*) FILTER (WHERE severity='HIGH') AS high
               FROM deif_alerts"""
        )[0],
    }

    next_actions = [
        {
            "title": "기상청 공공데이터포털 API 키 등록",
            "desc": "KMA_API_KEY 환경변수 등록 후 강수량·기상특보 자동 수집 활성화",
            "blocks": ["weather_warnings", "rainfall_obs"],
        },
        {
            "title": "행안부 일일상황보고서 409일치 수집",
            "desc": "사건 기간 일일 보고서 PDF 수집 후 events 메타 보강",
            "blocks": ["events"],
        },
    ]

    return {
        "pipeline": pipeline,
        "source_files": source_files,
        "quality": quality,
        "next_actions": next_actions,
    }


@router.get("/table/{table_name}")
def table_lineage(table_name: str):
    allowed = {"events", "cbs_messages", "weather_warnings",
               "vulnerability_zones", "deif_alerts", "rainfall_obs"}
    if table_name not in allowed:
        raise HTTPException(404, "unknown table")

    cols = query(
        """SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_name=%s
           ORDER BY ordinal_position""",
        (table_name,),
    )
    total = query(f"SELECT COUNT(*) AS c FROM {table_name}")[0]["c"]

    sources = []
    if table_name in ("vulnerability_zones", "weather_warnings"):
        sources = query(
            f"""SELECT source_file, COUNT(*) AS count
                FROM {table_name}
                WHERE source_file IS NOT NULL AND source_file <> ''
                GROUP BY source_file ORDER BY count DESC"""
        )

    date_range = None
    date_col = {
        "events": "started_at",
        "cbs_messages": "issued_at",
        "weather_warnings": "issued_at",
        "deif_alerts": "detected_at",
        "rainfall_obs": "obs_time",
    }.get(table_name)
    if date_col:
        r = query(f"SELECT MIN({date_col}) AS earliest, MAX({date_col}) AS latest FROM {table_name}")
        date_range = r[0] if r else None

    return {
        "table": table_name,
        "total": total,
        "columns": cols,
        "source_files": sources,
        "date_range": date_range,
    }
