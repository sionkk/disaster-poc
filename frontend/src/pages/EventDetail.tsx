import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import Timeline from "../components/Timeline";
import DeifPanel from "../components/DeifPanel";
import CBSPanel from "../components/CBSPanel";

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.event(eventId!),
    enabled: !!eventId,
  });

  if (isLoading) return <div className="spinner">로딩...</div>;
  if (!data) return <div className="empty">사건을 찾을 수 없습니다.</div>;

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">대시보드</Link> &gt; {data.event_id} {data.name}
      </div>

      <div className="detail-grid">
        <div className="panel">
          <div className="panel-header">
            <span>
              {data.special_disaster && <span style={{ color: "var(--amber)" }}>★ </span>}
              {data.name}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
              {data.event_id}
            </span>
          </div>
          <div className="panel-body">
            <dl className="detail-info-list">
              <dt>기간</dt>
              <dd>
                {data.started_at.slice(0, 10)} ~ {data.ended_at.slice(0, 10)}
              </dd>
              <dt>유형</dt>
              <dd>{data.disaster_type}</dd>
              <dt>지역</dt>
              <dd>{data.regions.join(", ")}</dd>
              <dt>사망 / 실종</dt>
              <dd style={{ color: "var(--red)" }}>
                {data.deaths}명 / {data.missing}명
              </dd>
              <dt>피해액</dt>
              <dd style={{ color: "var(--amber)" }}>{data.property_bil} 억원</dd>
              <dt>특별재난</dt>
              <dd>{data.special_disaster ? "★ 지정" : "-"}</dd>
              <dt>CBS 총건</dt>
              <dd style={{ fontFamily: "var(--mono)" }}>
                {data.cbs_summary?.total?.toLocaleString() ?? 0} (T1{" "}
                {data.cbs_summary?.tier1?.toLocaleString() ?? 0} / T2{" "}
                {data.cbs_summary?.tier2?.toLocaleString() ?? 0})
              </dd>
              <dt>대피 안내</dt>
              <dd style={{ color: "var(--amber)" }}>
                {data.cbs_summary?.evacuation?.toLocaleString() ?? 0} 건
              </dd>
              <dt>키워드</dt>
              <dd style={{ fontSize: 12, color: "var(--muted)" }}>
                {data.keywords.join(" · ")}
              </dd>
            </dl>
          </div>
        </div>

        <DeifPanel eventId={eventId!} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12,
          height: "calc(100vh - 480px)",
          minHeight: 380,
        }}
      >
        <Timeline eventId={eventId!} />
        <CBSPanel eventId={eventId!} />
      </div>
    </>
  );
}
