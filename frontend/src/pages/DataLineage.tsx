import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

function statusClass(status: string) {
  return "status-" + status.replace(/\s+/g, "-");
}

function statusIcon(status: string) {
  if (status === "완료") return "✅";
  if (status === "완료 (부분)") return "🟡";
  if (status === "미수집") return "⚠️";
  if (status === "대기 중") return "⏳";
  return "•";
}

function fmtDate(s: any) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("ko-KR", { hour12: false }); }
  catch { return String(s); }
}

export default function DataLineage() {
  const { data, isLoading } = useQuery({
    queryKey: ["lineage"],
    queryFn: api.lineage,
  });

  if (isLoading || !data) return <div className="spinner">로딩 중...</div>;

  const cbsQ = data.quality.cbs_messages || {};
  const vulnQ = data.quality.vulnerability_zones || {};
  const eventsQ = data.quality.events || {};
  const deifQ = data.quality.deif_alerts || {};

  return (
    <div className="page">
      <div className="page-header">
        <h2>데이터 원천 및 수집 현황</h2>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          파이프라인 6단계 · 소스 파일 {data.source_files.length}개
        </div>
      </div>

      <div className="page-body lineage-grid">
        {/* Pipeline */}
        <div className="lineage-section">
          <h3>📊 데이터 파이프라인</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.pipeline.map((step) => (
              <div key={step.step} className={`pipeline-row ${statusClass(step.status)}`}>
                <div className="step-num">{step.step}</div>
                <div>
                  <div className="stage-name">{step.name}</div>
                  <div className="stage-desc">{step.desc}</div>
                  {step.files.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, fontFamily: "var(--mono)" }}>
                      📄 {step.files.slice(0, 3).join(", ")}
                      {step.files.length > 3 && ` 외 ${step.files.length - 3}건`}
                    </div>
                  )}
                </div>
                <div>
                  {step.filter_desc && (
                    <div style={{ fontSize: 11, color: "var(--cyan)" }}>↳ {step.filter_desc}</div>
                  )}
                  {step.next_action && (
                    <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 2 }}>
                      ▸ {step.next_action}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, fontFamily: "var(--mono)" }}>
                    → {step.output_table}
                  </div>
                </div>
                <div className="stage-meta">
                  <span className="stage-count">{step.record_count.toLocaleString()}</span>
                  <span className="status-pill">{statusIcon(step.status)} {step.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source files */}
        <div className="lineage-section">
          <h3>📁 소스 파일별 적재 현황</h3>
          <div className="data-table-wrap" style={{ maxHeight: 240 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>파일명</th>
                  <th>테이블</th>
                  <th style={{ textAlign: "right" }}>건수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {data.source_files.map((f, i) => (
                  <tr key={i}>
                    <td className="wide">{f.source_file}</td>
                    <td className="mono">{f.table_name}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {f.count.toLocaleString()}
                    </td>
                    <td>{f.count > 0 ? "✅" : "⚠️"}</td>
                  </tr>
                ))}
                {data.pipeline
                  .filter((p) => p.record_count === 0)
                  .map((p, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="wide" style={{ color: "var(--muted)" }}>
                        {p.files[0] || "(API)"}
                      </td>
                      <td className="mono">{p.output_table}</td>
                      <td className="mono" style={{ textAlign: "right", color: "var(--muted)" }}>0</td>
                      <td>{statusIcon(p.status)} {p.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quality */}
        <div className="lineage-section">
          <h3>📈 데이터 품질 현황</h3>
          <div className="quality-grid">
            <div className="quality-card">
              <div className="title">events</div>
              <div className="stat"><span className="k">총 사건</span><span className="v">{eventsQ.total}</span></div>
              <div className="stat"><span className="k">특별재난</span><span className="v">{eventsQ.special}</span></div>
              <div className="stat"><span className="k">기간</span><span className="v">
                {fmtDate(eventsQ.earliest).slice(0,10)} ~ {fmtDate(eventsQ.latest).slice(0,10)}
              </span></div>
            </div>

            <div className="quality-card">
              <div className="title">cbs_messages</div>
              <div className="stat"><span className="k">총 건수</span><span className="v">{Number(cbsQ.total).toLocaleString()}</span></div>
              <div className="stat"><span className="k">TIER1 핵심</span><span className="v">{Number(cbsQ.tier1).toLocaleString()}</span></div>
              <div className="stat"><span className="k">TIER2 관련</span><span className="v">{Number(cbsQ.tier2).toLocaleString()}</span></div>
              <div className="stat"><span className="k">기타</span><span className="v">{Number(cbsQ.other).toLocaleString()}</span></div>
              <div className="stat"><span className="k">대피 포함</span><span className="v">{Number(cbsQ.evacuation).toLocaleString()}</span></div>
              <div className="stat"><span className="k">기간</span><span className="v">
                {fmtDate(cbsQ.earliest).slice(0,10)} ~ {fmtDate(cbsQ.latest).slice(0,10)}
              </span></div>
            </div>

            <div className="quality-card">
              <div className="title">vulnerability_zones</div>
              <div className="stat"><span className="k">총 건수</span><span className="v">{Number(vulnQ.total).toLocaleString()}</span></div>
              <div className="stat">
                <span className="k">좌표 보유</span>
                <span className="v">
                  {Number(vulnQ.with_coords).toLocaleString()}
                  <span style={{ color: "var(--muted)" }}> ({vulnQ.total ? Math.round(vulnQ.with_coords / vulnQ.total * 100) : 0}%)</span>
                </span>
              </div>
              <div className="stat"><span className="k">대피장소 명시</span><span className="v">{Number(vulnQ.with_evacuate).toLocaleString()}</span></div>
            </div>

            <div className="quality-card">
              <div className="title">deif_alerts</div>
              <div className="stat"><span className="k">총 알림</span><span className="v">{deifQ.total}</span></div>
              <div className="stat"><span className="k">CRITICAL</span><span className="v" style={{ color: "var(--red)" }}>{deifQ.critical}</span></div>
              <div className="stat"><span className="k">HIGH</span><span className="v" style={{ color: "var(--amber)" }}>{deifQ.high}</span></div>
            </div>
          </div>
        </div>

        {/* Next actions */}
        <div className="lineage-section">
          <h3>🎯 다음 수집 액션</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.next_actions.map((a, i) => (
              <div key={i} style={{
                padding: "10px 12px",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid var(--amber)",
                borderRadius: 6,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber)" }}>
                  ▸ {a.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text)", marginTop: 4 }}>{a.desc}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontFamily: "var(--mono)" }}>
                  영향 테이블: {a.blocks.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
