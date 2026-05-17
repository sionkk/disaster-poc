import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

const RULE_LABEL: Record<string, string> = {
  RULE_01: "CBS 발송 지연",
  RULE_05: "대피 CBS 지연",
  RULE_06: "대피명령 누락",
  RULE_07: "대피 비율 저조",
  RULE_08: "야간 대피 부족",
};

export default function DeifPanel({ eventId }: { eventId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["deif", eventId],
    queryFn: () => api.deif(eventId),
  });

  return (
    <div className="panel">
      <div className="panel-header">
        <span>DEIF 이상탐지 ({data?.length ?? 0})</span>
      </div>
      <div className="panel-body">
        {isLoading && <div className="spinner">로딩...</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div className="empty">이상탐지 결과 없음</div>
        )}
        {data?.map((a) => (
          <div key={a.id} className={`deif-card ${a.severity.toLowerCase()}`}>
            <div className="row1">
              <div className="title-line">{a.title}</div>
              <span className="severity-pill">{a.severity}</span>
            </div>
            <div className="meta">
              <span style={{ fontFamily: "var(--mono)" }}>{a.rule_code}</span>
              {" · "}
              {RULE_LABEL[a.rule_code] || ""}
              {a.delay_minutes != null && (
                <>
                  {" · "}
                  <b>{a.delay_minutes}분 지연</b>
                </>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>{a.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
