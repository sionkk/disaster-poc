import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

const COLORS: Record<string, string> = {
  landslide_risk: "#8B4513",
  landslide: "#D2691E",
  flood_trace: "#22b0d8",
  life_risk: "#e03838",
  hazard_zone: "#e8a020",
};

export default function MapView() {
  const { data } = useQuery({
    queryKey: ["vulnerability"],
    queryFn: () => api.vulnerability(),
  });

  const markers = (data ?? []).filter((d) => d.lat != null && d.lon != null);

  return (
    <div className="panel">
      <div className="panel-header">
        <span>취약지역 지도 ({markers.length})</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {markers.length === 0 ? "데이터 없음" : "마커 클릭 → 상세"}
        </span>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        <MapContainer
          center={[36.5, 127.8]}
          zoom={7}
          style={{ height: "100%", minHeight: 240, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers.map((m) => (
            <CircleMarker
              key={m.id}
              center={[Number(m.lat), Number(m.lon)]}
              radius={5}
              pathOptions={{
                color: COLORS[m.zone_type] || "#888",
                fillColor: COLORS[m.zone_type] || "#888",
                fillOpacity: 0.6,
              }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <b>{m.zone_name || m.zone_type}</b>
                  <br />
                  <span style={{ color: "#666" }}>{m.address}</span>
                  <br />
                  유형: {m.risk_type}
                  {m.grade && <> · 등급: {m.grade}</>}
                  {m.evacuate_place && (
                    <>
                      <br />
                      대피: {m.evacuate_place}
                    </>
                  )}
                  {m.evacuate_criteria && (
                    <>
                      <br />
                      기준: {m.evacuate_criteria}
                    </>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
