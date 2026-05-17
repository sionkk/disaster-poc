import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import EventList from "../components/EventList";
import WarningPanel from "../components/WarningPanel";
import MapView from "../components/MapView";

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.statsSummary });

  return (
    <>
      <div className="stat-cards">
        <div className="stat-card">
          <div className="label">총 사망 / 실종</div>
          <div className="value red">
            {stats?.total_deaths ?? "-"}
            <span style={{ fontSize: 14, color: "var(--muted)" }}>
              {" / "}
              {stats?.total_missing ?? "-"}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">총 재산피해</div>
          <div className="value amber">
            {stats?.total_property_bil?.toLocaleString() ?? "-"}
            <span style={{ fontSize: 14, color: "var(--muted)" }}> 억</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">CBS TIER1 / 대피안내</div>
          <div className="value cyan">
            {stats?.total_cbs_tier1?.toLocaleString() ?? "-"}
            <span style={{ fontSize: 14, color: "var(--muted)" }}>
              {" / "}
              {stats?.total_cbs_evacuation?.toLocaleString() ?? "-"}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="label">DEIF 알림 / CRITICAL</div>
          <div className="value green">
            {stats?.total_deif_alerts ?? "-"}
            <span style={{ fontSize: 14, color: "var(--red)" }}>
              {" / "}
              {stats?.deif_critical ?? "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="layout">
        <EventList />
        <div className="right-grid">
          <WarningPanel />
          <MapView />
        </div>
      </div>
    </>
  );
}
