# 재난 종합 학습 상황판 PoC — Claude Code 작업 지시서

---

## ⚡ Auto Mode 설정

```bash
# 1. 프로젝트 폴더에 이 CLAUDE.md 복사 후 Claude Code 실행
mkdir disaster-poc && cd disaster-poc
claude

# 2. Shift+Tab → "Auto" 모드 선택

# 3. 프롬프트 입력
# "CLAUDE.md 지시서를 Step 1부터 끝까지 순서대로 구현해줘"
```

`.claude/settings.json` (Claude Code가 Step 1에서 생성):
```json
{
  "permissions": {
    "allow": [
      "Bash(psql*)",
      "Bash(createdb*)",
      "Bash(createuser*)",
      "Bash(python3*)",
      "Bash(pip*)",
      "Bash(npm*)",
      "Bash(node*)",
      "Bash(mkdir*)",
      "Bash(cp*)",
      "Bash(chmod*)",
      "Bash(brew*)",
      "Bash(uvicorn*)",
      "Bash(curl http://localhost*)",
      "Bash(source*)",
      "Bash(pkill*)"
    ]
  }
}
```

---

## 0. 환경 정보

```
OS:         macOS (Homebrew)
PostgreSQL: 16.13 (Homebrew) — 현재 macOS 로그인 사용자가 슈퍼유저
Python:     3.14.4
Node:       v25.9.0
Docker:     사용 안 함
```

---

## 1. 프로젝트 구조

```
disaster-poc/
├── CLAUDE.md
├── .claude/settings.json
├── .env
├── start.sh
├── stop.sh
│
├── db/
│   ├── schema.sql
│   └── seed/
│       ├── load_all.py
│       ├── load_events.py
│       ├── load_cbs.py
│       ├── load_warnings.py
│       ├── load_vulnerability.py
│       └── compute_deif.py
│
├── backend/
│   ├── requirements.txt
│   ├── .venv/
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       └── routers/
│           ├── events.py
│           ├── cbs.py
│           ├── warnings.py
│           ├── vulnerability.py
│           └── stats.py
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── api/client.ts
        ├── components/
        │   ├── EventList.tsx
        │   ├── Timeline.tsx
        │   ├── CBSPanel.tsx
        │   ├── WarningPanel.tsx
        │   ├── MapView.tsx
        │   └── DeifPanel.tsx
        ├── pages/
        │   ├── Dashboard.tsx
        │   └── EventDetail.tsx
        ├── store/useAppStore.ts
        └── types/index.ts
```

---

## 2. 소스 데이터 경로

```
DATA_EVENTS   = /home/claude/poc_data/events.json
DATA_CBS      = /home/claude/poc_data/cbs_filtered_tiered.csv
DATA_KMA_PLAN = /home/claude/poc_data/collection_plan_kma.json

RAW = /home/claude/참고자료_raw/참고자료

기상청 특보:
  RAW/재난문자/기상청특보통보문.csv
  RAW/재난문자/기상청_특보통보문.csv
  RAW/재난문자/기상청_예비특보.csv
  RAW/재난문자/기상청특보구역코드.csv

취약지역:
  RAW/재난취약지역/03. 산사태취약지역/산사태우려지역.csv
  RAW/재난취약지역/03. 산사태취약지역/경상남도_산사태취약지역지정현황_20240508.csv
  RAW/재난취약지역/06. 침수흔적/행정안전부_침수흔적도.csv
  RAW/재난취약지역/04. 인명피해우려지역/전라남도_광양시_인명피해우려지역 지정 현황_20250718.csv
  RAW/재난취약지역/09. 기타취약지역정보/지역재해위험지구.csv
  RAW/재난취약지역/09. 기타취약지역정보/피해상황-침수상황.csv
  RAW/재난취약지역/09. 기타취약지역정보/피해상황-재난발생정보.csv
```

---

## 3. .env

```env
# DB (Homebrew PostgreSQL — DB_USER는 Step 1에서 whoami 결과로 채움)
DB_NAME=disaster_poc
DB_USER=
DB_HOST=localhost
DB_PORT=5432

# 서버 포트
BACKEND_PORT=8000
FRONTEND_PORT=5173

# KMA API (나중에 등록)
KMA_API_KEY=
```

---

## 4. DB 스키마 (`db/schema.sql`)

```sql
-- PostGIS (없으면 경고 후 계속)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS 없음 — 공간 인덱스 비활성화';
END $$;

-- 사건 마스터 (32건)
CREATE TABLE IF NOT EXISTS events (
    event_id         VARCHAR(20)   PRIMARY KEY,
    year             SMALLINT      NOT NULL,
    name             VARCHAR(100)  NOT NULL,
    disaster_type    VARCHAR(30)   NOT NULL,
    started_at       DATE          NOT NULL,
    ended_at         DATE          NOT NULL,
    regions          TEXT[]        NOT NULL,
    keywords         TEXT[]        NOT NULL,
    deaths           SMALLINT      DEFAULT 0,
    missing          SMALLINT      DEFAULT 0,
    property_bil     NUMERIC(10,1) DEFAULT 0,
    special_disaster BOOLEAN       DEFAULT FALSE,
    created_at       TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_year    ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(disaster_type);
CREATE INDEX IF NOT EXISTS idx_events_started ON events(started_at);

-- CBS 긴급재난문자 (11,515건)
CREATE TABLE IF NOT EXISTS cbs_messages (
    id             BIGSERIAL    PRIMARY KEY,
    event_id       VARCHAR(20)  REFERENCES events(event_id),
    event_name     VARCHAR(100),
    disaster_type  VARCHAR(30),
    issued_at      TIMESTAMPTZ,
    location_name  TEXT,
    content        TEXT         NOT NULL,
    send_platform  VARCHAR(20)  DEFAULT 'cbs',
    tier           VARCHAR(30)  NOT NULL DEFAULT 'TIER2_재난관련',
    has_evacuation BOOLEAN      DEFAULT FALSE,
    has_warning    BOOLEAN      DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_cbs_event    ON cbs_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_cbs_issued   ON cbs_messages(issued_at);
CREATE INDEX IF NOT EXISTS idx_cbs_tier     ON cbs_messages(tier);

-- 기상 특보
CREATE TABLE IF NOT EXISTS weather_warnings (
    id            BIGSERIAL    PRIMARY KEY,
    event_id      VARCHAR(20)  REFERENCES events(event_id),
    issued_at     TIMESTAMPTZ,
    warning_type  VARCHAR(30),
    warning_level VARCHAR(10),
    region_name   TEXT,
    content       TEXT,
    source_file   VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_wrn_event  ON weather_warnings(event_id);
CREATE INDEX IF NOT EXISTS idx_wrn_issued ON weather_warnings(issued_at);

-- 취약지역
CREATE TABLE IF NOT EXISTS vulnerability_zones (
    id                BIGSERIAL    PRIMARY KEY,
    zone_type         VARCHAR(30)  NOT NULL,
    zone_name         TEXT,
    address           TEXT,
    region_sido       VARCHAR(20),
    region_sgg        VARCHAR(30),
    lat               NUMERIC(10,7),
    lon               NUMERIC(10,7),
    grade             VARCHAR(10),
    risk_type         VARCHAR(50),
    evacuate_place    TEXT,
    evacuate_criteria TEXT,
    area_m2           NUMERIC(15,2),
    source_file       VARCHAR(100),
    extra_json        JSONB
);
CREATE INDEX IF NOT EXISTS idx_vuln_type ON vulnerability_zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_vuln_sido ON vulnerability_zones(region_sido);

-- DEIF 이상탐지
CREATE TABLE IF NOT EXISTS deif_alerts (
    id            BIGSERIAL    PRIMARY KEY,
    event_id      VARCHAR(20)  REFERENCES events(event_id),
    rule_code     VARCHAR(20)  NOT NULL,
    severity      VARCHAR(10)  NOT NULL,
    title         TEXT         NOT NULL,
    detail        TEXT,
    delay_minutes INTEGER,
    detected_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deif_event    ON deif_alerts(event_id);
CREATE INDEX IF NOT EXISTS idx_deif_severity ON deif_alerts(severity);

-- 강수량 (KMA API 키 등록 후 수집)
CREATE TABLE IF NOT EXISTS rainfall_obs (
    id            BIGSERIAL    PRIMARY KEY,
    event_id      VARCHAR(20)  REFERENCES events(event_id),
    station_id    INTEGER,
    obs_time      TIMESTAMPTZ,
    precipitation NUMERIC(6,1),
    temperature   NUMERIC(5,1),
    wind_speed    NUMERIC(5,1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rain_stn_time ON rainfall_obs(station_id, obs_time);

-- 요약 뷰
CREATE OR REPLACE VIEW v_event_summary AS
SELECT
    e.*,
    COUNT(DISTINCT c.id)                                        AS cbs_total,
    COUNT(DISTINCT c.id) FILTER (WHERE c.tier='TIER1_핵심재난') AS cbs_tier1,
    COUNT(DISTINCT c.id) FILTER (WHERE c.has_evacuation)       AS cbs_evacuation,
    COUNT(DISTINCT w.id)                                        AS warning_count,
    COUNT(DISTINCT da.id)                                       AS deif_alerts,
    COUNT(DISTINCT da.id) FILTER (WHERE da.severity='CRITICAL') AS deif_critical
FROM events e
LEFT JOIN cbs_messages c    ON c.event_id = e.event_id
LEFT JOIN weather_warnings w ON w.event_id = e.event_id
LEFT JOIN deif_alerts da    ON da.event_id = e.event_id
GROUP BY e.event_id;
```

---

## 5. 백엔드

### `backend/requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
psycopg[binary]==3.2.3
python-dotenv==1.0.1
pydantic==2.9.0
```

> psycopg[binary] (psycopg3) 사용 — Python 3.14와 호환성 최상.
> psycopg2-binary는 Python 3.14 휠이 없을 수 있으므로 사용하지 않음.

### `backend/app/config.py`

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / ".env")

DB_NAME = os.getenv("DB_NAME", "disaster_poc")
DB_USER = os.getenv("DB_USER") or os.getenv("USER") or ""
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
```

### `backend/app/database.py`

```python
import psycopg
from psycopg.rows import dict_row
from app.config import DB_NAME, DB_USER, DB_HOST, DB_PORT

CONNSTR = f"dbname={DB_NAME} user={DB_USER} host={DB_HOST} port={DB_PORT}"

def get_conn():
    return psycopg.connect(CONNSTR)

def query(sql: str, params=None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()

def execute(sql: str, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
        conn.commit()
```

### `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.routers import events, cbs, warnings, vulnerability, stats

app = FastAPI(title="재난 종합 학습 상황판 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events.router,        prefix="/api/events")
app.include_router(cbs.router,           prefix="/api/cbs")
app.include_router(warnings.router,      prefix="/api/warnings")
app.include_router(vulnerability.router, prefix="/api/vulnerability")
app.include_router(stats.router,         prefix="/api/stats")

@app.get("/health")
def health():
    return {"status": "ok"}
```

### `backend/app/routers/events.py` 구현 엔드포인트

```
GET /api/events
    ?year=INT&type=STR&special=BOOL&limit=50&offset=0
    → v_event_summary 뷰 조회
    → [{event_id, name, disaster_type, started_at, ended_at,
        deaths, missing, property_bil, special_disaster,
        cbs_total, cbs_tier1, deif_alerts, deif_critical}]

GET /api/events/{event_id}
    → 사건 상세 (v_event_summary 한 건)
      + deif_alerts 목록
      + cbs 요약 (총건수, tier1, 대피)

GET /api/events/{event_id}/timeline
    → 기상특보 + CBS 시간순 통합 목록
    → [{time, type, tier, content, location, severity}]
    type: "warning" | "cbs"
    tier: "TIER1_핵심재난" | "TIER2_재난관련" | null

GET /api/events/{event_id}/cbs
    ?tier=STR&limit=100&offset=0
    → CBS 메시지 목록

GET /api/events/{event_id}/deif
    → DEIF 이상탐지 결과 목록

GET /api/events/{event_id}/warnings
    → 기상특보 목록
```

### `backend/app/routers/stats.py` 구현 엔드포인트

```
GET /api/stats/summary
    → {total_events, total_deaths, total_missing,
       total_cbs, total_cbs_tier1, total_property_bil,
       special_disaster_count}

GET /api/stats/by-year
    → [{year, event_count, deaths, property_bil, cbs_tier1}]

GET /api/stats/by-type
    → [{disaster_type, event_count, deaths, property_bil}]

GET /api/stats/cbs-by-event
    → [{event_id, name, cbs_tier1}] 내림차순 (차트용)
```

### `backend/app/routers/vulnerability.py` 구현 엔드포인트

```
GET /api/vulnerability
    ?type=STR&sido=STR&limit=500
    → [{id, zone_type, zone_name, lat, lon,
        risk_type, grade, address, evacuate_place, evacuate_criteria}]
    lat/lon 없는 항목은 제외

GET /api/vulnerability/types
    → [{zone_type, count}]
```

---

## 6. 데이터 로더

### `db/seed/load_all.py`

```python
#!/usr/bin/env python3
import subprocess, sys, os

scripts = [
    "load_events.py",
    "load_cbs.py",
    "load_warnings.py",
    "load_vulnerability.py",
    "compute_deif.py",
]
seed_dir = os.path.dirname(os.path.abspath(__file__))
for s in scripts:
    print(f"\n{'='*50}\n▶ {s}\n{'='*50}")
    result = subprocess.run(
        [sys.executable, os.path.join(seed_dir, s)], check=False
    )
    if result.returncode != 0:
        print(f"⚠  {s} 실패 — 계속 진행")
```

### `db/seed/load_events.py`

```python
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn

PATH = "/home/claude/poc_data/events.json"

def main():
    events = json.load(open(PATH))
    with get_conn() as conn:
        with conn.cursor() as cur:
            for ev in events:
                cur.execute("""
                    INSERT INTO events
                      (event_id,year,name,disaster_type,started_at,ended_at,
                       regions,keywords,deaths,missing,property_bil,special_disaster)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (event_id) DO UPDATE SET
                      name=EXCLUDED.name, deaths=EXCLUDED.deaths,
                      property_bil=EXCLUDED.property_bil
                """, (ev["event_id"],ev["year"],ev["name"],ev["type"],
                      ev["start"],ev["end"],ev["regions"],ev["keywords"],
                      ev["deaths"],ev["missing"],ev["property_bil"],ev["special_disaster"]))
        conn.commit()
    print(f"✅ events: {len(events)}건")

if __name__ == "__main__":
    main()
```

### `db/seed/load_cbs.py`

```python
import csv, sys, os
from datetime import datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn

PATH = "/home/claude/poc_data/cbs_filtered_tiered.csv"
EVAC_KW = ['대피','피하','긴급대피','대피명령','소개령']
WARN_KW = ['경보','주의보']

def parse_dt(s):
    for fmt in ["%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
        try: return datetime.strptime(s.strip(), fmt)
        except: pass
    return None

def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            batch = []
            with open(PATH, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    dt = parse_dt(row.get("create_date",""))
                    if not dt: continue
                    msg = row.get("msg","")
                    batch.append((
                        row["event_id"], row.get("event_name",""),
                        row.get("disaster_type",""), dt,
                        row.get("location_name",""), msg[:1000],
                        row.get("send_platform","cbs"),
                        row.get("tier","TIER2_재난관련"),
                        any(k in msg for k in EVAC_KW),
                        any(k in msg for k in WARN_KW),
                    ))
                    if len(batch) >= 500:
                        cur.executemany("""
                            INSERT INTO cbs_messages
                              (event_id,event_name,disaster_type,issued_at,
                               location_name,content,send_platform,tier,
                               has_evacuation,has_warning)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """, batch)
                        total += len(batch); batch = []
            if batch:
                cur.executemany("""
                    INSERT INTO cbs_messages
                      (event_id,event_name,disaster_type,issued_at,
                       location_name,content,send_platform,tier,
                       has_evacuation,has_warning)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, batch)
                total += len(batch)
        conn.commit()
    print(f"✅ cbs_messages: {total:,}건")

if __name__ == "__main__":
    main()
```

### `db/seed/load_warnings.py`

```python
import csv, io, os, json, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn

events = json.load(open("/home/claude/poc_data/events.json"))
EVENT_RANGES = [(e["start"].replace("-",""), e["end"].replace("-",""), e["event_id"])
                for e in events]

FILES = [
    "/home/claude/참고자료_raw/참고자료/재난문자/기상청특보통보문.csv",
    "/home/claude/참고자료_raw/참고자료/재난문자/기상청_특보통보문.csv",
]

def find_event(dt_str):
    if not dt_str or len(dt_str) < 8: return None
    d = str(dt_str)[:8].replace("-","")
    for s, e, eid in EVENT_RANGES:
        if s <= d <= e: return eid
    return None

def read_csv(path):
    raw = open(path,"rb").read()
    for enc in ["utf-8-sig","cp949","euc-kr"]:
        try: return list(csv.DictReader(io.StringIO(raw.decode(enc))))
        except: pass
    return []

def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            for path in FILES:
                if not os.path.exists(path): continue
                for row in read_csv(path):
                    issued = row.get("NDMS_PRSNTN_TM") or row.get("PRSNTN_TM","")
                    eid = find_event(issued)
                    if not eid: continue
                    title = row.get("TTL","")
                    lvl = "경보" if "경보" in title else "주의보" if "주의보" in title else ""
                    typ = next((k for k in ["호우","태풍","대설","강풍","산사태"]
                                if k in title), "기타")
                    cur.execute("""
                        INSERT INTO weather_warnings
                          (event_id,issued_at,warning_type,warning_level,
                           region_name,content,source_file)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                    """, (eid, issued or None, typ+lvl, lvl,
                          row.get("RLVT_ZONE",""),
                          row.get("PRSNTN_CN","")[:500],
                          os.path.basename(path)))
                    total += 1
        conn.commit()
    print(f"✅ weather_warnings: {total:,}건")

if __name__ == "__main__":
    main()
```

### `db/seed/load_vulnerability.py`

```python
import csv, io, os, json, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn

def dms(d, m, s):
    try: return float(d) + float(m)/60 + float(s)/3600
    except: return None

def sf(v):
    try: return float(str(v).replace(",",""))
    except: return None

def read_csv(path):
    if not os.path.exists(path): return []
    raw = open(path,"rb").read()
    for enc in ["utf-8-sig","cp949","euc-kr"]:
        try: return list(csv.DictReader(io.StringIO(raw.decode(enc))))
        except: pass
    return []

def insert(cur, rows, zone_type, mapper):
    n = 0
    for row in rows:
        r = mapper(row)
        if not r: continue
        cur.execute("""
            INSERT INTO vulnerability_zones
              (zone_type,zone_name,address,region_sido,region_sgg,
               lat,lon,grade,risk_type,evacuate_place,evacuate_criteria,
               area_m2,source_file,extra_json)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (zone_type, r.get("name",""), r.get("addr",""),
              r.get("sido",""), r.get("sgg",""),
              r.get("lat"), r.get("lon"),
              r.get("grade",""), r.get("risk",""),
              r.get("evac",""), r.get("crit",""),
              r.get("area"), r.get("src",""),
              json.dumps(dict(row), ensure_ascii=False)))
        n += 1
    return n

BASE = "/home/claude/참고자료_raw/참고자료/재난취약지역"

def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            total += insert(cur,
                read_csv(BASE+"/03. 산사태취약지역/산사태우려지역.csv"),
                "landslide_risk",
                lambda r: {"name":r.get("DSTRCT_NM",""), "addr":r.get("DADDR",""),
                           "risk":"산사태", "grade":r.get("RSK_GRD_CD",""),
                           "evac":r.get("SHNT_PLC_NM_1",""), "src":"산사태우려지역.csv"})

            total += insert(cur,
                read_csv(BASE+"/03. 산사태취약지역/경상남도_산사태취약지역지정현황_20240508.csv"),
                "landslide",
                lambda r: {"name":r.get("소재지",""), "addr":r.get("소재지",""),
                           "lat":dms(r.get("위도_도",0),r.get("위도_분",0),r.get("위도_초",0)),
                           "lon":dms(r.get("경도_도",0),r.get("경도_분",0),r.get("경도_초",0)),
                           "risk":r.get("취약지역유형","토석류"),
                           "evac":r.get("대피장소",""), "area":sf(r.get("지정면적_제곱미터","")),
                           "src":"경남_산사태취약지역.csv"})

            total += insert(cur,
                read_csv(BASE+"/06. 침수흔적/행정안전부_침수흔적도.csv"),
                "flood_trace",
                lambda r: {"name":r.get("FLDN_DST_NM",""),
                           "risk":"침수흔적", "grade":r.get("FLDN_GRD",""),
                           "area":sf(r.get("FLDN_AREA","")), "src":"행안부_침수흔적도.csv"})

            total += insert(cur,
                read_csv(BASE+"/04. 인명피해우려지역/전라남도_광양시_인명피해우려지역 지정 현황_20250718.csv"),
                "life_risk",
                lambda r: {"name":r.get("지구명",""), "addr":r.get("위치",""),
                           "risk":r.get("분류",""), "crit":r.get("대피기준",""),
                           "evac":r.get("대피장소",""), "src":"광양시_인명피해우려.csv"})

            total += insert(cur,
                read_csv(BASE+"/09. 기타취약지역정보/지역재해위험지구.csv"),
                "hazard_zone",
                lambda r: {"name":r.get("DST_RSK_DSTRCT_NM",""),
                           "addr":r.get("DADDR","") or r.get("RONA_DADDR",""),
                           "risk":r.get("DST_RSK_DSTRCT_TYPE_CD",""),
                           "grade":r.get("DST_RSK_DSTRCT_GRD_CD",""),
                           "src":"지역재해위험지구.csv"})
        conn.commit()
    print(f"✅ vulnerability_zones: {total:,}건")

if __name__ == "__main__":
    main()
```

### `db/seed/compute_deif.py`

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn

def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT event_id FROM events ORDER BY started_at")
            eids = [r[0] for r in cur.fetchall()]

            for eid in eids:
                # Rule 01: 경보 후 CBS 발송 지연 (30분 초과)
                cur.execute("""
                    SELECT w.id,
                           EXTRACT(EPOCH FROM (
                               (SELECT MIN(issued_at) FROM cbs_messages
                                WHERE event_id=%s AND tier='TIER1_핵심재난'
                                  AND issued_at > w.issued_at)
                               - w.issued_at
                           ))/60 AS delay_min
                    FROM weather_warnings w
                    WHERE w.event_id=%s AND w.warning_level='경보'
                """, (eid, eid))

                for wrn_id, delay in cur.fetchall():
                    if delay and delay > 30:
                        cur.execute("""
                            INSERT INTO deif_alerts
                              (event_id,rule_code,severity,title,detail,delay_minutes)
                            VALUES (%s,'RULE_01','CRITICAL','CBS 발송 지연',
                              '경보 후 ' || %s::int || '분 경과 후 최초 CBS 발송 (기준 30분)',
                              %s::int)
                        """, (eid, int(delay), int(delay)))
                        total += 1

                # Rule 06: 경보 있는데 대피명령 CBS 없음
                cur.execute("SELECT COUNT(*) FROM weather_warnings WHERE event_id=%s AND warning_level='경보'", (eid,))
                if cur.fetchone()[0] > 0:
                    cur.execute("SELECT COUNT(*) FROM cbs_messages WHERE event_id=%s AND has_evacuation", (eid,))
                    if cur.fetchone()[0] == 0:
                        cur.execute("""
                            INSERT INTO deif_alerts
                              (event_id,rule_code,severity,title,detail)
                            VALUES (%s,'RULE_06','CRITICAL','CBS 대피명령 누락',
                              '기상경보 발령되었으나 대피명령 CBS 미발송')
                        """, (eid,))
                        total += 1

        conn.commit()
    print(f"✅ deif_alerts: {total}건")

if __name__ == "__main__":
    main()
```

---

## 7. 프론트엔드

### `frontend/package.json`

```json
{
  "name": "disaster-poc",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev":     "vite",
    "build":   "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react":              "^18.3.0",
    "react-dom":          "^18.3.0",
    "react-router-dom":   "^6.26.0",
    "@tanstack/react-query": "^5.56.0",
    "recharts":           "^2.13.0",
    "leaflet":            "^1.9.4",
    "react-leaflet":      "^4.2.1",
    "zustand":            "^5.0.0",
    "date-fns":           "^4.1.0",
    "clsx":               "^2.1.1"
  },
  "devDependencies": {
    "@types/react":       "^18.3.0",
    "@types/react-dom":   "^18.3.0",
    "@types/leaflet":     "^1.9.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript":         "^5.5.0",
    "vite":               "^5.4.0"
  }
}
```

### `frontend/src/index.css` — 디자인 시스템

```css
:root {
  --bg:     #06090f;
  --bg2:    #0c1220;
  --bg3:    #111a2e;
  --border: #1a2d48;
  --amber:  #e8a020;
  --cyan:   #22b0d8;
  --green:  #28c870;
  --red:    #e03838;
  --purple: #8855d8;
  --text:   #c0d0e0;
  --muted:  #607890;
  --mono:   'JetBrains Mono', 'Fira Code', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, 'Noto Sans KR', sans-serif;
  font-size: 14px;
  line-height: 1.6;
}
```

### 페이지 레이아웃

**`Dashboard.tsx`**
```
┌─ HEADER: 재난 종합 학습 상황판 | 32사건 | CBS 11,515건 ─────┐
│  통계 카드 4개: 총사망 | 총피해액 | CBS TIER1 | DEIF 알림   │
├─ 좌 패널 (EventList) ──┬─ 우 패널 ────────────────────────┤
│  연도 필터 (드롭다운)    │  연도별 피해액 바차트 (Recharts)  │
│  유형 필터 (드롭다운)    ├──────────────────────────────────┤
│  ★특별재난 토글         │  취약지역 지도 (Leaflet)          │
│                         │  유형별 색상 마커                 │
│  사건 카드 목록:        ├──────────────────────────────────┤
│  사건명 | 기간 | 사망   │  재난유형별 파이차트              │
│  클릭 → EventDetail     │                                  │
└────────────────────────┴──────────────────────────────────┘
```

**`EventDetail.tsx`**
```
┌─ 브레드크럼: 대시보드 > E2023-002 오송 집중호우 ────────────┐
├─ 사건 요약 카드 (좌) ──────── DEIF 패널 (우) ──────────────┤
│  기간 | 지역 | 사망/실종    RULE_01 CRITICAL: CBS 지연 NNmin│
│  피해액 | ★특별재난        RULE_06 CRITICAL: 대피명령 누락  │
│  CBS: TIER1 N건 | 대피 N건  severity 색상: 빨강/주황/노랑   │
├─ Timeline 패널 ─────────────────────────────────────────────┤
│  [기상특보🟡] 04:10 충북 청주 호우경보                      │
│  [CBS T1 🔴]  07:15 청주시 [행정안전부] 호우경보 대피 안내  │
│  [CBS T1 🔴]  08:35 [청주시] 궁평지하차도 침수 통행금지     │
│  스크롤 가능 | 대피 메시지 강조 표시                        │
├─ CBS 분석 패널 ─────────────────────────────────────────────┤
│  TIER1: N건 | TIER2: N건 | 대피명령: N건                   │
│  시간별 CBS 발송 건수 바차트 (Recharts)                     │
└────────────────────────────────────────────────────────────┘
```

### 컴포넌트별 구현 사항

**`EventList.tsx`**
- `/api/events` 조회 (React Query)
- 연도·재난유형·특별재난 필터
- 카드: event_id, name, started_at~ended_at, deaths+missing, property_bil, ★
- 특별재난 카드는 amber 보더

**`Timeline.tsx`**
- `/api/events/{id}/timeline` 조회
- 기상특보 🟡 amber, CBS TIER1 🔴 red, CBS TIER2 🔵 cyan 색상 구분
- has_evacuation=true 메시지 → 굵은 글씨 + 배경 강조
- 시간 포맷: MM/DD HH:mm

**`CBSPanel.tsx`**
- `/api/events/{id}/cbs` 조회
- 상단: TIER1/TIER2/대피명령 건수 뱃지
- Recharts BarChart: x=시간(1시간 단위), y=CBS 발송 건수
- TIER1만 표시 옵션 토글

**`DeifPanel.tsx`**
- `/api/events/{id}/deif` 조회
- severity 카드: CRITICAL=red, HIGH=orange, MEDIUM=amber
- rule_code 라벨: RULE_01="CBS발송지연", RULE_06="대피명령누락"
- delay_minutes 있으면 "XX분 지연" 배지 표시

**`MapView.tsx`**
- `/api/vulnerability?limit=500` 조회 (lat/lon 있는 것만)
- Leaflet CircleMarker, 유형별 색상:
  - landslide_risk → #8B4513 (갈색)
  - landslide      → #D2691E
  - flood_trace    → #22b0d8 (청색)
  - life_risk      → #e03838 (적색)
  - hazard_zone    → #e8a020 (황색)
- 클릭 팝업: zone_name, risk_type, evacuate_criteria, evacuate_place
- 대시보드에서 사건 선택 시 해당 regions 기준 필터링

**`StatsPanel.tsx`**
- `/api/stats/by-year` → Recharts ComposedChart (바=피해액, 선=사망)
- `/api/stats/by-type` → 재난유형 수평 바차트

---

## 8. 기동 스크립트

### `start.sh`

```bash
#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

# 포트 정리
pkill -f "uvicorn app.main" 2>/dev/null || true
pkill -f "vite"             2>/dev/null || true
sleep 1

# 백엔드
echo "▶ 백엔드 기동 (http://localhost:8000)..."
cd "$ROOT/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
sleep 2

# 헬스체크
curl -sf http://localhost:8000/health > /dev/null && echo "  ✅ 백엔드 OK" || echo "  ❌ 백엔드 실패"

# 프론트엔드
echo "▶ 프론트엔드 기동 (http://localhost:5173)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "════════════════════════════════"
echo "  대시보드: http://localhost:5173"
echo "  API Docs: http://localhost:8000/docs"
echo "  종료:     ./stop.sh"
echo "════════════════════════════════"

wait
```

### `stop.sh`

```bash
#!/bin/bash
pkill -f "uvicorn app.main" 2>/dev/null && echo "백엔드 종료" || true
pkill -f "vite"             2>/dev/null && echo "프론트엔드 종료" || true
```

---

## 9. 구현 순서 (Step by Step)

```
Step 1. 초기 설정
  .claude/settings.json 생성
  DB_USER=$(whoami) 확인 후 .env 파일 생성 (DB_USER 값 기입)

Step 2. DB 생성 및 스키마 적용
  createdb disaster_poc
  psql disaster_poc -f db/schema.sql
  psql disaster_poc -c "\dt"  ← 테이블 6개 확인

Step 3. Python 가상환경 및 패키지 설치
  cd backend
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  cd ..

Step 4. 데이터 적재 (약 2~3분)
  cd backend && source .venv/bin/activate && cd ..
  python3 db/seed/load_all.py

  적재 확인:
  psql disaster_poc -c "SELECT COUNT(*) FROM events;"          → 32
  psql disaster_poc -c "SELECT COUNT(*) FROM cbs_messages;"    → 11515
  psql disaster_poc -c "SELECT COUNT(*) FROM deif_alerts;"     → 1 이상

Step 5. 백엔드 구현
  backend/app/ 전체 구현 (config, database, main, routers 5개)
  cd backend && source .venv/bin/activate
  uvicorn app.main:app --reload

  확인:
  curl http://localhost:8000/health
  curl http://localhost:8000/api/events | python3 -m json.tool | head -40
  curl http://localhost:8000/api/events/E2023-002/timeline | python3 -m json.tool | head -60
  curl http://localhost:8000/api/stats/summary | python3 -m json.tool

Step 6. 프론트엔드 구현
  cd frontend
  npm install
  frontend/src/ 전체 구현
  npm run dev

Step 7. 기동 스크립트
  chmod +x start.sh stop.sh
  ./start.sh
```

---

## 10. 완료 체크리스트

```
□ psql disaster_poc -c "SELECT COUNT(*) FROM events;"        → 32
□ psql disaster_poc -c "SELECT COUNT(*) FROM cbs_messages;"  → 11515
□ psql disaster_poc -c "SELECT COUNT(*) FROM deif_alerts;"   → 1 이상
□ curl http://localhost:8000/health                          → {"status":"ok"}
□ curl http://localhost:8000/api/events                      → 32건 JSON
□ curl http://localhost:8000/api/events/E2023-002/timeline   → 타임라인 반환
□ curl http://localhost:8000/api/stats/summary               → 통계 숫자
□ http://localhost:5173                                      → 대시보드 표시
□ 사건 카드 클릭 → EventDetail 페이지 이동
□ Timeline 패널 → CBS·기상특보 시간순 표시
□ DEIF 패널 → CRITICAL 카드 빨간색
□ 지도 → 마커 표시 및 클릭 팝업
```

---

## 11. KMA API 키 등록 후 수집

```bash
# .env에 추가
echo "KMA_API_KEY=발급받은키" >> .env

# 오송 사건 1건 수집 테스트
cd backend && source .venv/bin/activate
python3 ../scripts/kma_collector.py --event E2023-002

# 전체 32사건 수집
python3 ../scripts/kma_collector.py --all
```

---

*CLAUDE.md v2.1 · 도커 없음 · macOS Homebrew PostgreSQL 16.13 · Python 3.14.4 · Node v25.9.0*
