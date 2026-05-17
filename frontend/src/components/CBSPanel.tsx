import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api/client";

export default function CBSPanel({ eventId }: { eventId: string }) {
  const { data } = useQuery({
    queryKey: ["timeline", eventId],
    queryFn: () => api.timeline(eventId),
  });

  const stats = useMemo(() => {
    if (!data) return { tier1: 0, tier2: 0, evac: 0 };
    let tier1 = 0, tier2 = 0, evac = 0;
    for (const t of data.timeline) {
      if (t.type !== "cbs") continue;
      if (t.tier === "TIER1_핵심재난") tier1++;
      else if (t.tier === "TIER2_재난관련") tier2++;
      if (t.has_evacuation) evac++;
    }
    return { tier1, tier2, evac };
  }, [data]);

  const hourly = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { hour: string; tier1: number; tier2: number; evac: number }>();
    for (const t of data.timeline) {
      if (t.type !== "cbs" || !t.time) continue;
      const d = new Date(t.time);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}`;
      const entry = map.get(key) ?? { hour: key, tier1: 0, tier2: 0, evac: 0 };
      if (t.tier === "TIER1_핵심재난") entry.tier1++;
      else if (t.tier === "TIER2_재난관련") entry.tier2++;
      if (t.has_evacuation) entry.evac++;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.hour.localeCompare(b.hour));
  }, [data]);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>CBS 분석</span>
        <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--red)" }}>T1 {stats.tier1.toLocaleString()}</span>
          <span style={{ color: "var(--cyan)" }}>T2 {stats.tier2.toLocaleString()}</span>
          <span style={{ color: "var(--amber)" }}>대피 {stats.evac.toLocaleString()}</span>
        </div>
      </div>
      <div className="panel-body" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourly}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1a2d48" />
            <XAxis dataKey="hour" stroke="#607890" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis stroke="#607890" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#0c1220", border: "1px solid #1a2d48", fontSize: 12 }}
              labelStyle={{ color: "#c0d0e0" }}
            />
            <Bar dataKey="tier1" stackId="a" fill="#e03838" name="T1" />
            <Bar dataKey="tier2" stackId="a" fill="#22b0d8" name="T2" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
