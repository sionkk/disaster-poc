import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api } from "../api/client";

const COLORS = ["#e8a020", "#22b0d8", "#28c870", "#e03838", "#8855d8", "#c0d0e0", "#607890"];

export default function WarningPanel() {
  const { data: byYear } = useQuery({ queryKey: ["byYear"], queryFn: api.statsByYear });
  const { data: byType } = useQuery({ queryKey: ["byType"], queryFn: api.statsByType });

  const pieData = useMemo(() => {
    if (!byType) return [];
    return byType.map((t) => ({ name: t.disaster_type, value: t.event_count }));
  }, [byType]);

  return (
    <div className="bottom-grid">
      <div className="panel">
        <div className="panel-header">
          <span>연도별 피해액 (억원) · 사망</span>
        </div>
        <div className="panel-body" style={{ minHeight: 260 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byYear ?? []}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1a2d48" />
              <XAxis dataKey="year" stroke="#607890" tick={{ fontSize: 11 }} />
              <YAxis stroke="#607890" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0c1220", border: "1px solid #1a2d48", fontSize: 12 }}
                labelStyle={{ color: "#c0d0e0" }}
              />
              <Bar dataKey="property_bil" fill="#e8a020" name="피해액(억)" />
              <Bar dataKey="deaths" fill="#e03838" name="사망" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>재난유형별 사건수</span>
        </div>
        <div className="panel-body" style={{ minHeight: 260 }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#0c1220", border: "1px solid #1a2d48", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
