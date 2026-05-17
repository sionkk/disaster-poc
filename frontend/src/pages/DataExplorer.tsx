import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type TableKey =
  | "events"
  | "cbs"
  | "warnings"
  | "vulnerability"
  | "deif";

interface ColumnDef {
  key: string;
  label: string;
  width?: number;
  render?: (row: any) => any;
}

const TABLE_TO_API: Record<TableKey, string> = {
  events: "events",
  cbs: "cbs_messages",
  warnings: "weather_warnings",
  vulnerability: "vulnerability_zones",
  deif: "deif_alerts",
};

const TABLE_LABELS: Record<TableKey, string> = {
  events: "사건",
  cbs: "CBS",
  warnings: "기상특보",
  vulnerability: "취약지역",
  deif: "DEIF 알림",
};

function fmtDate(s: any) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("ko-KR", { hour12: false });
  } catch {
    return String(s);
  }
}

function fmtDateOnly(s: any) {
  if (!s) return "—";
  try {
    return new Date(s).toISOString().slice(0, 10);
  } catch {
    return String(s);
  }
}

const COLUMNS: Record<TableKey, ColumnDef[]> = {
  events: [
    { key: "event_id", label: "ID" },
    { key: "name", label: "사건명" },
    { key: "disaster_type", label: "유형" },
    { key: "started_at", label: "기간", render: (r) =>
        `${fmtDateOnly(r.started_at)} ~ ${fmtDateOnly(r.ended_at)}` },
    { key: "deaths", label: "사망" },
    { key: "missing", label: "실종" },
    { key: "property_bil", label: "피해액(억)" },
    { key: "special_disaster", label: "★", render: (r) => r.special_disaster ? "★" : "" },
  ],
  cbs: [
    { key: "issued_at", label: "발송", render: (r) => fmtDate(r.issued_at) },
    { key: "event_id", label: "사건" },
    { key: "tier", label: "TIER", render: (r) => {
        const cls = r.tier?.startsWith("TIER1") ? "tier1"
          : r.tier?.startsWith("TIER2") ? "tier2" : "tier-ex";
        const lbl = r.tier?.startsWith("TIER1") ? "T1"
          : r.tier?.startsWith("TIER2") ? "T2" : "EX";
        return <span className={`pill ${cls}`}>{lbl}</span>;
      } },
    { key: "location_name", label: "지역" },
    { key: "content", label: "내용",
      render: (r) => (r.content || "").slice(0, 80) + ((r.content || "").length > 80 ? "…" : "") },
    { key: "has_evacuation", label: "대피",
      render: (r) => r.has_evacuation ? <span className="pill evac">대피</span> : "" },
  ],
  warnings: [
    { key: "issued_at", label: "발효", render: (r) => fmtDate(r.issued_at) },
    { key: "event_id", label: "사건" },
    { key: "warning_type", label: "유형" },
    { key: "warning_level", label: "수준" },
    { key: "region_name", label: "지역" },
  ],
  vulnerability: [
    { key: "zone_type", label: "구분",
      render: (r) => <span className={`pill zone-${r.zone_type}`}>{r.zone_type}</span> },
    { key: "zone_name", label: "지점명" },
    { key: "address", label: "주소" },
    { key: "risk_type", label: "위험유형" },
    { key: "grade", label: "등급" },
    { key: "evacuate_place", label: "대피장소" },
  ],
  deif: [
    { key: "detected_at", label: "탐지", render: (r) => fmtDate(r.detected_at) },
    { key: "event_id", label: "사건" },
    { key: "rule_code", label: "규칙" },
    { key: "severity", label: "심각도",
      render: (r) => <span className={`pill ${r.severity?.toLowerCase()}`}>{r.severity}</span> },
    { key: "title", label: "제목" },
    { key: "delay_minutes", label: "지연(분)",
      render: (r) => r.delay_minutes != null ? `${r.delay_minutes}분` : "" },
  ],
};

const PAGE_SIZE = 50;

export default function DataExplorer() {
  const [active, setActive] = useState<TableKey>("events");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [globalSubmitted, setGlobalSubmitted] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  // additional filters
  const [yearFilter, setYearFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [eventIdFilter, setEventIdFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [evacuationFilter, setEvacuationFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const { data: tables } = useQuery({
    queryKey: ["explorer", "tables"],
    queryFn: api.explorerTables,
    refetchInterval: 60000,
  });

  const filterParams = useMemo(() => {
    const base: Record<string, any> = { limit: PAGE_SIZE, offset };
    if (search) base.search = search;
    if (active === "events") {
      if (yearFilter) base.year = yearFilter;
      if (typeFilter) base.type = typeFilter;
    }
    if (active === "cbs") {
      if (eventIdFilter) base.event_id = eventIdFilter;
      if (tierFilter) base.tier = tierFilter;
      if (evacuationFilter) base.has_evacuation = evacuationFilter === "true";
    }
    if (active === "warnings") {
      if (eventIdFilter) base.event_id = eventIdFilter;
    }
    if (active === "vulnerability") {
      if (typeFilter) base.type = typeFilter;
    }
    if (active === "deif") {
      if (eventIdFilter) base.event_id = eventIdFilter;
      if (severityFilter) base.severity = severityFilter;
    }
    return base;
  }, [active, offset, search, yearFilter, typeFilter, eventIdFilter, tierFilter, evacuationFilter, severityFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["explorer", active, filterParams],
    queryFn: () => api.explorerQuery(active, filterParams),
  });

  const { data: searchResults } = useQuery({
    queryKey: ["explorer", "search", globalSubmitted],
    queryFn: () => api.explorerSearch(globalSubmitted, 50),
    enabled: !!globalSubmitted,
  });

  const cols = COLUMNS[active];
  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function switchTab(k: TableKey) {
    setActive(k);
    setOffset(0);
    setSearch("");
    setSelected(null);
    setYearFilter(""); setTypeFilter(""); setEventIdFilter("");
    setTierFilter(""); setEvacuationFilter(""); setSeverityFilter("");
  }

  function highlight(text: string, q: string) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  function tabCount(key: TableKey): number | undefined {
    const apiName = TABLE_TO_API[key];
    return tables?.find((t) => t.table === apiName)?.count;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>데이터 탐색기</h2>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          DB 테이블 직접 조회·검색·필터
        </div>
      </div>

      <div className="page-body">
        <div className="tab-bar">
          {(Object.keys(TABLE_LABELS) as TableKey[]).map((k) => (
            <button key={k}
              className={"tab" + (active === k ? " active" : "")}
              onClick={() => switchTab(k)}>
              {TABLE_LABELS[k]}
              <span className="count">{tabCount(k)?.toLocaleString() ?? "-"}</span>
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="🔍 통합검색 (사건명·CBS 내용·취약지역명)"
            value={globalQuery}
            onChange={(e) => setGlobalQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setGlobalSubmitted(globalQuery); }}
            style={{ minWidth: 280 }}
          />
          <button onClick={() => setGlobalSubmitted(globalQuery)}>검색</button>
          {globalSubmitted && (
            <button onClick={() => { setGlobalSubmitted(""); setGlobalQuery(""); }}>닫기</button>
          )}
          <div style={{ width: 1, height: 22, background: "var(--border)", margin: "0 6px" }} />
          <input
            type="text"
            placeholder={active === "events" ? "사건명 검색" :
              active === "cbs" ? "CBS 내용 검색" :
              active === "vulnerability" ? "지점명·주소 검색" :
              "검색"}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            disabled={active === "warnings" || active === "deif"}
          />
          {active === "events" && (
            <>
              <input type="number" placeholder="연도"
                value={yearFilter} style={{ width: 80 }}
                onChange={(e) => { setYearFilter(e.target.value); setOffset(0); }} />
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }}>
                <option value="">전체 유형</option>
                <option value="호우">호우</option>
                <option value="태풍">태풍</option>
                <option value="대설·한파">대설·한파</option>
                <option value="대설">대설</option>
                <option value="강풍">강풍</option>
                <option value="산사태">산사태</option>
                <option value="지진">지진</option>
              </select>
            </>
          )}
          {(active === "cbs" || active === "warnings" || active === "deif") && (
            <input type="text" placeholder="event_id"
              value={eventIdFilter} style={{ width: 110 }}
              onChange={(e) => { setEventIdFilter(e.target.value); setOffset(0); }} />
          )}
          {active === "cbs" && (
            <>
              <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setOffset(0); }}>
                <option value="">전체 TIER</option>
                <option value="TIER1_핵심재난">TIER1</option>
                <option value="TIER2_재난관련">TIER2</option>
              </select>
              <select value={evacuationFilter} onChange={(e) => { setEvacuationFilter(e.target.value); setOffset(0); }}>
                <option value="">대피여부</option>
                <option value="true">대피포함</option>
                <option value="false">대피없음</option>
              </select>
            </>
          )}
          {active === "vulnerability" && (
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setOffset(0); }}>
              <option value="">전체 구분</option>
              <option value="landslide_risk">산사태우려</option>
              <option value="landslide">산사태지정</option>
              <option value="flood_trace">침수흔적</option>
              <option value="life_risk">인명피해우려</option>
              <option value="hazard_zone">재해위험지구</option>
            </select>
          )}
          {active === "deif" && (
            <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setOffset(0); }}>
              <option value="">전체 심각도</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
            </select>
          )}
        </div>

        {globalSubmitted ? (
          <div className="search-results">
            {!searchResults && <div className="spinner">검색 중...</div>}
            {searchResults && searchResults.results.length === 0 && (
              <div className="empty">검색 결과 없음</div>
            )}
            {searchResults?.results.map((r, i) => (
              <div key={i} className="search-result-item"
                onClick={() => {
                  if (r.table === "events" && r.event_id) {
                    window.location.href = `/events/${r.event_id}`;
                  } else if (r.table === "cbs_messages") {
                    switchTab("cbs");
                    setGlobalSubmitted(""); setGlobalQuery("");
                    if (r.event_id) setEventIdFilter(r.event_id);
                    setSearch(globalSubmitted);
                  } else if (r.table === "vulnerability_zones") {
                    switchTab("vulnerability");
                    setGlobalSubmitted(""); setGlobalQuery("");
                    setSearch(globalSubmitted);
                  }
                }}>
                <div className="meta">
                  <span className="pill">{r.table}</span>
                  {r.event_id && <span>{r.event_id}</span>}
                  <span>매칭: {r.matched_field}</span>
                </div>
                <div className="summary">{highlight(r.summary, globalSubmitted)}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={cols.length} className="spinner">로딩 중...</td></tr>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <tr><td colSpan={cols.length} className="empty">데이터 없음</td></tr>
                  )}
                  {rows.map((row, i) => (
                    <tr key={i}
                      className={selected === row ? "selected" : ""}
                      onClick={() => setSelected(row)}>
                      {cols.map((c) => (
                        <td key={c.key} className={
                          c.key.includes("_id") || c.key.includes("_at") || c.key === "year" ? "mono" : ""
                        }>
                          {c.render ? c.render(row) : (row[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <div>총 {total.toLocaleString()}건 · {PAGE_SIZE}건/페이지</div>
              <div className="controls">
                <button disabled={offset === 0} onClick={() => setOffset(0)}>◀◀</button>
                <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>◀</button>
                <span style={{ minWidth: 80, textAlign: "center" }}>
                  {currentPage} / {totalPages}
                </span>
                <button disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>▶</button>
                <button disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset((totalPages - 1) * PAGE_SIZE)}>▶▶</button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="side-panel">
          <div className="side-panel-header">
            <h3>{TABLE_LABELS[active]} 상세</h3>
            <button className="close-btn" onClick={() => setSelected(null)}>×</button>
          </div>
          <div className="side-panel-body">
            <dl className="kv">
              {Object.entries(selected).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd>{
                    v == null ? "—" :
                    typeof v === "boolean" ? (v ? "true" : "false") :
                    typeof v === "object" ? <pre>{JSON.stringify(v, null, 2)}</pre> :
                    String(v)
                  }</dd>
                </div>
              ))}
            </dl>
            {selected.event_id && (
              <div style={{ marginTop: 12 }}>
                <Link to={`/events/${selected.event_id}`}>
                  → 사건 상세로 이동 ({selected.event_id})
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
