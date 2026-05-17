import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { api } from "../api/client";
import { useAppStore } from "../store/useAppStore";

export default function EventList() {
  const navigate = useNavigate();
  const { filterYear, filterType, filterSpecial, setFilterYear, setFilterType, setFilterSpecial } =
    useAppStore();
  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.events({ limit: 100 }),
  });

  const years = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map((e) => e.year))).sort((a, b) => b - a);
  }, [data]);
  const types = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map((e) => e.disaster_type))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((e) => {
      if (filterYear != null && e.year !== filterYear) return false;
      if (filterType != null && e.disaster_type !== filterType) return false;
      if (filterSpecial != null && e.special_disaster !== filterSpecial) return false;
      return true;
    });
  }, [data, filterYear, filterType, filterSpecial]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>사건 목록 ({filtered.length}/{data?.length ?? 0})</span>
      </div>
      <div className="filters">
        <select
          value={filterYear ?? ""}
          onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">전체 연도</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={filterType ?? ""}
          onChange={(e) => setFilterType(e.target.value || null)}
        >
          <option value="">전체 유형</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className={filterSpecial ? "active" : ""}
          onClick={() => setFilterSpecial(filterSpecial ? null : true)}
        >
          ★ 특별재난
        </button>
      </div>
      <div className="panel-body">
        {isLoading && <div className="spinner">로딩...</div>}
        {filtered.map((e) => (
          <div
            key={e.event_id}
            className={`event-card${e.special_disaster ? " special" : ""}`}
            onClick={() => navigate(`/events/${e.event_id}`)}
          >
            <div className="row1">
              <div className="name">
                {e.special_disaster && <span style={{ color: "var(--amber)" }}>★ </span>}
                {e.name}
              </div>
              <div className="id">{e.event_id}</div>
            </div>
            <div className="meta">
              <span>{e.started_at.slice(0, 10)} ~ {e.ended_at.slice(0, 10)}</span>
              <span>{e.disaster_type}</span>
            </div>
            <div className="badges">
              {e.deaths > 0 && <span className="badge red">사망 {e.deaths}</span>}
              {e.missing > 0 && <span className="badge red">실종 {e.missing}</span>}
              <span className="badge">{e.property_bil}억</span>
              {e.cbs_tier1 > 0 && (
                <span className="badge cyan">CBS T1 {e.cbs_tier1.toLocaleString()}</span>
              )}
              {e.deif_alerts > 0 && (
                <span className="badge amber">DEIF {e.deif_alerts}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
