import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { api } from "../api/client";
import type { TimelineItem } from "../types";

function fmtTime(t: string) {
  const d = new Date(t);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function itemClass(t: TimelineItem) {
  if (t.type === "warning") return "timeline-item warning";
  if (t.tier === "TIER1_핵심재난") return `timeline-item cbs-t1${t.has_evacuation ? " evac" : ""}`;
  if (t.tier === "TIER2_재난관련") return "timeline-item cbs-t2";
  return "timeline-item cbs-ex";
}

function itemLabel(t: TimelineItem) {
  if (t.type === "warning") return "WARN";
  if (t.tier === "TIER1_핵심재난") return "T1";
  if (t.tier === "TIER2_재난관련") return "T2";
  return "EX";
}

export default function Timeline({ eventId }: { eventId: string }) {
  const [tierFilter, setTierFilter] = useState<"all" | "tier1" | "evac" | "warning">("tier1");
  const { data, isLoading } = useQuery({
    queryKey: ["timeline", eventId],
    queryFn: () => api.timeline(eventId),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.timeline.filter((t) => {
      if (tierFilter === "all") return true;
      if (tierFilter === "warning") return t.type === "warning";
      if (tierFilter === "tier1") return t.type === "warning" || t.tier === "TIER1_핵심재난";
      if (tierFilter === "evac") return t.has_evacuation || t.type === "warning";
      return true;
    });
  }, [data, tierFilter]);

  return (
    <div className="panel" style={{ minHeight: 0 }}>
      <div className="panel-header">
        <span>타임라인 ({filtered.length.toLocaleString()})</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className={tierFilter === "tier1" ? "active" : ""} onClick={() => setTierFilter("tier1")}>
            T1+특보
          </button>
          <button className={tierFilter === "evac" ? "active" : ""} onClick={() => setTierFilter("evac")}>
            대피
          </button>
          <button className={tierFilter === "all" ? "active" : ""} onClick={() => setTierFilter("all")}>
            전체
          </button>
        </div>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        {isLoading && <div className="spinner">로딩...</div>}
        {!isLoading && filtered.length === 0 && <div className="empty">표시할 항목 없음</div>}
        {filtered.slice(0, 1000).map((t, i) => (
          <div key={i} className={itemClass(t)}>
            <div className="ts">{fmtTime(t.time)}</div>
            <div className="label">{itemLabel(t)}</div>
            <div>
              <div className="content">{t.content}</div>
              {t.location && <div className="loc">📍 {t.location.slice(0, 60)}</div>}
            </div>
          </div>
        ))}
        {filtered.length > 1000 && (
          <div className="spinner">+{filtered.length - 1000}건 (성능상 1000건까지 표시)</div>
        )}
      </div>
    </div>
  );
}
