# 재난 상황판 PoC — 추가 기능 구현 지시서

기존 시스템(백엔드 8000, 프론트엔드 5173)이 실행 중인 상태에서 아래 3개 기능을 추가한다.

---

## 추가 기능 개요

| 기능 | 경로 | 설명 |
|------|------|------|
| 데이터 탐색기 | `/explorer` | 적재된 DB 테이블 직접 조회·검색·필터 |
| 지식 맵 | `/knowledge-map` | 사건·데이터·지역 간 관계 시각화 |
| 데이터 원천 | `/lineage` | 각 데이터의 출처·수집경로·품질 현황 |

---

## 1. 백엔드 추가 엔드포인트

### `backend/app/routers/explorer.py`

```
GET /api/explorer/tables
    → 전체 테이블 목록 + 건수 + 최신 적재 시각
    → [
        {table: "events",             count: 32,    last_loaded: "..."},
        {table: "cbs_messages",       count: 11515, last_loaded: "..."},
        {table: "weather_warnings",   count: 0,     last_loaded: null},
        {table: "vulnerability_zones",count: 2779,  last_loaded: "..."},
        {table: "deif_alerts",        count: 11,    last_loaded: "..."},
        {table: "rainfall_obs",       count: 0,     last_loaded: null},
      ]

GET /api/explorer/events
    ?year=&type=&special=&search=&limit=50&offset=0&sort=started_at&dir=desc
    → events 테이블 필터+검색+정렬+페이지네이션

GET /api/explorer/cbs
    ?event_id=&tier=&search=&has_evacuation=&limit=100&offset=0
    → cbs_messages 테이블 조회
    → search는 content 컬럼 ILIKE 검색

GET /api/explorer/warnings
    ?event_id=&type=&level=&limit=100&offset=0
    → weather_warnings 테이블 조회

GET /api/explorer/vulnerability
    ?type=&sido=&search=&limit=100&offset=0
    → vulnerability_zones 테이블 조회

GET /api/explorer/deif
    ?event_id=&severity=&rule=&limit=100&offset=0
    → deif_alerts 테이블 조회

GET /api/explorer/search?q=&limit=50
    → 전체 테이블 통합 검색 (CBS content, 사건명, 취약지역명)
    → [{table, id, event_id, summary, matched_field}]
```

### `backend/app/routers/knowledge_map.py`

```
GET /api/knowledge-map
    → D3 force graph용 노드·엣지 데이터
    → {
        nodes: [
          # 사건 노드 (32개)
          {id:"E2023-002", type:"event", label:"오송 집중호우",
           size: deaths+missing, color:"#e03838", year:2023},

          # 재난유형 노드 (5~6개)
          {id:"type_호우", type:"disaster_type", label:"호우",
           size: 이벤트수, color:"#22b0d8"},

          # 지역 노드 (17개 시도)
          {id:"region_충북", type:"region", label:"충북",
           size: 관련사건수, color:"#28c870"},

          # 데이터소스 노드 (CBS, 기상특보, 취약지역 등)
          {id:"src_cbs", type:"datasource", label:"CBS 재난문자\n11,515건",
           size:11515, color:"#8855d8"},
          {id:"src_vuln", type:"datasource", label:"취약지역\n2,779건",
           size:2779, color:"#e8a020"},
          {id:"src_deif", type:"datasource", label:"DEIF 알림\n11건",
           size:110, color:"#e03838"},
        ],
        links: [
          # 사건 → 재난유형
          {source:"E2023-002", target:"type_호우", value:1},

          # 사건 → 지역 (regions 배열 기반)
          {source:"E2023-002", target:"region_충북", value:1},

          # 사건 → CBS (cbs_tier1 건수 비례)
          {source:"E2023-002", target:"src_cbs", value:2174},

          # 사건 → DEIF
          {source:"E2023-002", target:"src_deif", value:3},
        ]
      }

GET /api/knowledge-map/event/{event_id}
    → 특정 사건 중심 서브그래프
    → 해당 사건의 CBS·특보·취약지역·DEIF만 포함한 노드+엣지
```

### `backend/app/routers/lineage.py`

```
GET /api/lineage
    → 전체 데이터 원천 현황
    → {
        pipeline: [
          {
            step: 1,
            name: "재해연보 PDF",
            type: "source",
            desc: "행정안전부 발행 연도별 자연재난 통계집 (2016~2024, 9개 연도)",
            output_table: "events",
            record_count: 32,
            files: ["2016 재해연보.pdf", "2017 재해연보.pdf", ...],
            status: "완료"
          },
          {
            step: 2,
            name: "CBS 긴급재난문자",
            type: "source",
            desc: "행정안전부 재난문자방송 전문 데이터 (2011~2024, 원본 20만건)",
            output_table: "cbs_messages",
            record_count: 11515,
            files: ["행정안전부_재난문자방송_20111118-20240831.csv"],
            filter_desc: "사건 기간·지역 매칭 필터 → 11,515건 / 3단계 TIER 분류",
            status: "완료"
          },
          {
            step: 3,
            name: "기상청 특보 통보문",
            type: "source",
            desc: "기상청 특보 발효·해제 이력 CSV",
            output_table: "weather_warnings",
            record_count: 0,
            files: ["기상청특보통보문.csv", "기상청_특보통보문.csv"],
            filter_desc: "샘플 100행 — 2016~2024 기간 해당 데이터 부재",
            status: "미수집",
            next_action: "기상청 공공데이터포털 API 키 등록 후 수집 가능"
          },
          {
            step: 4,
            name: "재난 취약지역",
            type: "source",
            desc: "산사태·침수흔적·인명피해우려·지역재해위험지구 CSV",
            output_table: "vulnerability_zones",
            record_count: 2779,
            files: [
              "산사태우려지역.csv",
              "경상남도_산사태취약지역지정현황.csv",
              "행정안전부_침수흔적도.csv",
              "광양시_인명피해우려지역.csv",
              "지역재해위험지구.csv"
            ],
            status: "완료"
          },
          {
            step: 5,
            name: "DEIF 이상탐지",
            type: "derived",
            desc: "기상특보-CBS 매칭 기반 자동 생성. CBS 단독 분석(RULE_05·07·08)으로 11건 생성",
            output_table: "deif_alerts",
            record_count: 11,
            files: [],
            status: "완료 (부분)",
            next_action: "기상특보 데이터 확보 시 RULE_01·06 추가 탐지 가능"
          },
          {
            step: 6,
            name: "기상청 API 강수량",
            type: "api",
            desc: "공공데이터포털 기상청 ASOS·AWS 시간별 강수량 (사건별 수집 예정)",
            output_table: "rainfall_obs",
            record_count: 0,
            files: [],
            status: "대기 중",
            next_action: "KMA_API_KEY 환경변수 등록 후 scripts/kma_collector.py 실행"
          }
        ],
        source_files: [
          # vulnerability_zones의 source_file별 건수
        ]
      }

GET /api/lineage/table/{table_name}
    → 특정 테이블의 상세 원천 정보
    → source_file별 건수, 날짜 범위, 컬럼 목록
```

---

## 2. 프론트엔드 추가 페이지

### 네비게이션 바 수정 (`App.tsx`)

기존 라우트에 3개 추가:
```
/ → Dashboard (기존)
/events/:id → EventDetail (기존)
/explorer → DataExplorer (신규)
/knowledge-map → KnowledgeMap (신규)
/lineage → DataLineage (신규)
```

헤더에 탭 메뉴 추가:
```
[대시보드] [데이터 탐색기] [지식 맵] [데이터 원천]
```

---

### `src/pages/DataExplorer.tsx`

```
레이아웃:
┌─ HEADER: 데이터 탐색기 ────────────────────────────────────┐
│  테이블 탭: [사건32] [CBS 11,515] [특보 0] [취약지역 2,779] │
│             [DEIF 11] [강수량 0]                            │
├─ 필터 바 (테이블별 다른 필터) ──────────────────────────────┤
│  🔍 통합검색: [________________] [검색]                     │
│  사건: [전체▼]  기간: [____~____]  유형: [전체▼]           │
├─ 데이터 테이블 ──────────────────────────────────────────────┤
│  컬럼 헤더 (클릭 시 정렬)                                   │
│  행 데이터 (스트라이프, 호버 강조)                           │
│  행 클릭 시 상세 사이드패널 열림                             │
├─ 페이지네이션: [◀] 1/231 [▶]  50건씩 표시                  │
└────────────────────────────────────────────────────────────┘
```

**테이블별 표시 컬럼:**

- **events**: event_id, name, disaster_type, started_at~ended_at, deaths, missing, property_bil, ★
- **cbs_messages**: issued_at, event_id, tier(색상 배지), location_name, content(앞 80자), has_evacuation
- **weather_warnings**: issued_at, event_id, warning_type, warning_level, region_name
- **vulnerability_zones**: zone_type(배지), zone_name, address, risk_type, grade, evacuate_place
- **deif_alerts**: detected_at, event_id, rule_code, severity(색상), title, delay_minutes

**통합검색:**
- CBS content, 사건명, 취약지역명 동시 검색
- 결과에 어느 테이블에서 매칭됐는지 표시
- 검색어 하이라이팅

---

### `src/pages/KnowledgeMap.tsx`

D3.js force-directed graph 사용 (`import * as d3 from 'd3'`)

```
레이아웃:
┌─ HEADER: 지식 맵 + 범례 ──────────────────────────────────┐
│  범례: ● 사건  ■ 재난유형  ▲ 지역  ◆ 데이터소스          │
│  필터: [전체] [호우만] [★특별재난만] [2023년]             │
├─ D3 Force Graph (전체 화면) ────────────────────────────────┤
│                                                             │
│     [CBS 재난문자]──────[E2023-002]──────[충북]            │
│          ╲               /    ╲            /                │
│           ╲        [호우]      ╲         /                  │
│            ╲                   [DEIF]                      │
│         [취약지역]──────[E2022-001]──────[서울]            │
│                                                             │
│  노드 크기: 피해규모(사건) / 건수(데이터소스)               │
│  엣지 굵기: 관계 강도(CBS 건수, 연결 수)                   │
│  노드 클릭 → 상세패널 표시                                  │
│  드래그·줌 가능                                             │
├─ 우측 상세패널 (노드 클릭 시) ────────────────────────────┤
│  노드명, 타입, 관련 건수                                    │
│  연결된 노드 목록                                           │
│  → 해당 페이지로 이동 링크                                  │
└────────────────────────────────────────────────────────────┘
```

**D3 구현 사항:**
- `d3.forceSimulation` + `forceLink` + `forceManyBody` + `forceCenter`
- 노드 타입별 색상: event=#e03838, disaster_type=#22b0d8, region=#28c870, datasource=#8855d8
- 노드 크기: 사건은 deaths*3+10, 데이터소스는 log(count)*5
- 엣지: 사건-CBS는 amber, 사건-지역은 green, 사건-유형은 cyan
- 줌: `d3.zoom()` 적용
- 툴팁: 호버 시 노드명+건수 표시
- SVG로 렌더링 (React ref 사용)

---

### `src/pages/DataLineage.tsx`

```
레이아웃:
┌─ HEADER: 데이터 원천 및 수집 현황 ─────────────────────────┐
├─ 파이프라인 타임라인 (가로 흐름) ──────────────────────────┤
│                                                             │
│  [재해연보PDF] → [사건DB 32건✅]                           │
│       ↓                                                     │
│  [CBS 20만건] → [필터링] → [11,515건✅] → [TIER분류]      │
│       ↓                                                     │
│  [기상청CSV]  → [샘플100행] → [특보 0건⚠️]               │
│       ↓                                                     │
│  [취약지역CSV] → [5종 통합] → [2,779건✅]                 │
│       ↓                                                     │
│  [자동계산]   → [DEIF 11건✅]                             │
│       ↓                                                     │
│  [KMA API]    → [미수집⏳] → API키 등록 필요             │
│                                                             │
├─ 소스 파일별 적재 현황 테이블 ─────────────────────────────┤
│  파일명 | 테이블 | 건수 | 상태 | 비고                      │
│  행정안전부_재난문자방송... | cbs_messages | 11,515 | ✅  │
│  산사태우려지역.csv | vulnerability_zones | 101 | ✅       │
│  경상남도_산사태취약지역... | vulnerability_zones | 800 | ✅│
│  기상청특보통보문.csv | weather_warnings | 0 | ⚠️ 샘플    │
│  (KMA API) | rainfall_obs | 0 | ⏳ 대기                   │
├─ 데이터 품질 현황 ──────────────────────────────────────────┤
│  테이블별 NULL 비율, 좌표 보유율, 날짜 커버리지            │
│  vulnerability_zones: lat/lon 보유 N건 / 전체 2,779건      │
│  cbs_messages: TIER1 7,730건 / TIER2 3,221건 / EXCL 564건 │
├─ 다음 수집 액션 ────────────────────────────────────────────┤
│  [ KMA API 키 등록 방법 보기 ]                             │
│  [ 행안부 일일상황보고서 409일치 수집 목록 다운로드 ]       │
└────────────────────────────────────────────────────────────┘
```

---

## 3. 패키지 추가

`frontend/package.json`에 D3 추가:
```json
"d3": "^7.9.0",
"@types/d3": "^7.4.0"
```

```bash
cd frontend && npm install d3 @types/d3
```

---

## 4. 구현 순서

```
Step 1. 백엔드 라우터 3개 추가
  backend/app/routers/explorer.py
  backend/app/routers/knowledge_map.py
  backend/app/routers/lineage.py
  backend/app/main.py에 include_router 추가

Step 2. 백엔드 재시작 후 API 확인
  pkill -f uvicorn
  cd backend && source .venv/bin/activate
  uvicorn app.main:app --reload &
  curl http://localhost:8000/api/explorer/tables
  curl http://localhost:8000/api/knowledge-map | python3 -m json.tool | head -50
  curl http://localhost:8000/api/lineage | python3 -m json.tool | head -50

Step 3. 프론트엔드 패키지 설치
  cd frontend && npm install d3 @types/d3

Step 4. 프론트엔드 페이지 3개 구현
  src/pages/DataExplorer.tsx
  src/pages/KnowledgeMap.tsx
  src/pages/DataLineage.tsx

Step 5. App.tsx 라우트·네비게이션 추가

Step 6. 동작 확인
  http://localhost:5173/explorer       → 테이블 탭·검색 동작
  http://localhost:5173/knowledge-map  → D3 그래프 렌더링·드래그 가능
  http://localhost:5173/lineage        → 파이프라인 흐름·소스 테이블
```

---

## 5. 완료 체크리스트

```
□ GET /api/explorer/tables → 6개 테이블 + 건수 반환
□ GET /api/explorer/cbs?search=대피 → 검색 결과 반환
□ GET /api/knowledge-map → nodes 40개 이상, links 50개 이상
□ GET /api/lineage → pipeline 6단계 반환
□ /explorer → 테이블 탭 전환, 행 클릭 사이드패널
□ /explorer → 통합검색 "오송" → CBS·사건 동시 결과
□ /knowledge-map → D3 그래프 표시, 노드 드래그 가능
□ /knowledge-map → 노드 클릭 시 우측 상세패널
□ /knowledge-map → 사건 필터(호우만) 동작
□ /lineage → 파이프라인 6단계 시각화
□ /lineage → 소스파일별 건수 테이블
□ /lineage → 미수집 항목 ⚠️·⏳ 상태 표시
```

---

*추가기능 지시서 v1.0 · 기존 disaster-poc 위에 추가 구현*
