import { Routes, Route, Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";
import Dashboard from "./pages/Dashboard";
import EventDetail from "./pages/EventDetail";
import DataExplorer from "./pages/DataExplorer";
import KnowledgeMap from "./pages/KnowledgeMap";
import DataLineage from "./pages/DataLineage";

const TABS = [
  { to: "/", label: "대시보드" },
  { to: "/explorer", label: "데이터 탐색기" },
  { to: "/knowledge-map", label: "지식 맵" },
  { to: "/lineage", label: "데이터 원천" },
];

export default function App() {
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.statsSummary });

  return (
    <div className="app">
      <header className="header">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link to="/" style={{ textDecoration: "none" }}>
            <h1>재난 종합 학습 상황판</h1>
          </Link>
          <nav className="nav-tabs">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                className={({ isActive }) => "nav-tab" + (isActive ? " active" : "")}
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="stats-row">
          <span>
            사건수<b>{stats?.total_events ?? "-"}</b>
          </span>
          <span>
            CBS<b>{stats?.total_cbs?.toLocaleString() ?? "-"}</b>
          </span>
          <span>
            DEIF<b>{stats?.total_deif_alerts ?? "-"}</b>
          </span>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/explorer" element={<DataExplorer />} />
          <Route path="/knowledge-map" element={<KnowledgeMap />} />
          <Route path="/lineage" element={<DataLineage />} />
        </Routes>
      </main>
    </div>
  );
}
