import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import * as d3 from "d3";
import { api, type KMapNode, type KMapLink } from "../api/client";

type FilterMode = "all" | "호우" | "태풍" | "대설·한파" | "special" | "y2023" | "y2022";

interface SimNode extends KMapNode, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number;
  kind: string;
}

const LINK_COLOR: Record<string, string> = {
  "event-type": "#22b0d8",
  "event-region": "#28c870",
  "event-cbs": "#e8a020",
  "event-warn": "#e03838",
  "event-deif": "#8855d8",
  "event-warning": "#e03838",
  "event-vuln": "#8855d8",
};

export default function KnowledgeMap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<SimNode | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-map"],
    queryFn: api.knowledgeMap,
  });

  const filtered = useMemo(() => {
    if (!data) return { nodes: [], links: [] };

    let visibleEvents = new Set<string>();
    data.nodes.forEach((n) => {
      if (n.type !== "event") return;
      let keep = true;
      if (filter === "special") keep = !!n.special;
      else if (filter === "y2023") keep = n.year === 2023;
      else if (filter === "y2022") keep = n.year === 2022;
      else if (filter !== "all") keep = n.disaster_type === filter;
      if (keep) visibleEvents.add(n.id);
    });

    const keptNodeIds = new Set<string>(visibleEvents);
    data.links.forEach((l) => {
      const src = typeof l.source === "string" ? l.source : l.source.id;
      const tgt = typeof l.target === "string" ? l.target : l.target.id;
      if (visibleEvents.has(src)) keptNodeIds.add(tgt);
      if (visibleEvents.has(tgt)) keptNodeIds.add(src);
    });

    const nodes = data.nodes
      .filter((n) => keptNodeIds.has(n.id))
      .map((n) => ({ ...n })) as SimNode[];
    const links = data.links
      .filter((l) => {
        const src = typeof l.source === "string" ? l.source : (l.source as KMapNode).id;
        const tgt = typeof l.target === "string" ? l.target : (l.target as KMapNode).id;
        return keptNodeIds.has(src) && keptNodeIds.has(tgt);
      })
      .map((l) => ({ source: l.source as any, target: l.target as any, value: l.value, kind: l.kind })) as SimLink[];

    return { nodes, links };
  }, [data, filter]);

  useEffect(() => {
    if (!filtered.nodes.length || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (e) => g.attr("transform", e.transform.toString()));
    svg.call(zoom as any);

    const sim = d3.forceSimulation<SimNode, SimLink>(filtered.nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(filtered.links)
        .id((d) => d.id)
        .distance((l) => (l.kind === "event-region" ? 70 : l.kind === "event-type" ? 60 : 100))
        .strength(0.4))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide<SimNode>().radius((d) => d.size + 4));
    simRef.current = sim;

    const link = g.append("g")
      .selectAll("line")
      .data(filtered.links)
      .join("line")
      .attr("class", "link")
      .attr("stroke", (d) => LINK_COLOR[d.kind] || "#445")
      .attr("stroke-width", (d) => Math.min(4, Math.max(0.5, Math.log(d.value + 1) * 0.8)));

    const node = g.append("g")
      .selectAll("circle")
      .data(filtered.nodes)
      .join("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#0c1220")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", (e, d) => {
        const tt = tooltipRef.current;
        if (!tt) return;
        tt.style.display = "block";
        tt.textContent = `${d.label}\n${d.type}${d.count != null ? ` · ${d.count.toLocaleString()}건` : ""}`;
      })
      .on("mousemove", (e) => {
        const tt = tooltipRef.current;
        if (!tt) return;
        const cr = containerRef.current!.getBoundingClientRect();
        tt.style.left = `${e.clientX - cr.left + 12}px`;
        tt.style.top = `${e.clientY - cr.top + 12}px`;
      })
      .on("mouseout", () => {
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
      })
      .on("click", (_e, d) => setSelected(d))
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on("start", (e, d) => {
            if (!e.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on("end", (e, d) => {
            if (!e.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          }) as any,
      );

    const labels = g.append("g")
      .selectAll("text")
      .data(filtered.nodes)
      .join("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => d.size + 11)
      .text((d) => d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as SimNode).x!)
        .attr("y1", (d) => (d.source as SimNode).y!)
        .attr("x2", (d) => (d.target as SimNode).x!)
        .attr("y2", (d) => (d.target as SimNode).y!);
      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      labels.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    return () => { sim.stop(); };
  }, [filtered]);

  const neighbors = useMemo(() => {
    if (!selected || !data) return [];
    const ids = new Set<string>();
    data.links.forEach((l) => {
      const src = typeof l.source === "string" ? l.source : (l.source as KMapNode).id;
      const tgt = typeof l.target === "string" ? l.target : (l.target as KMapNode).id;
      if (src === selected.id) ids.add(tgt);
      if (tgt === selected.id) ids.add(src);
    });
    return data.nodes.filter((n) => ids.has(n.id));
  }, [selected, data]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>지식 맵</h2>
        <div className="filter-bar" style={{ padding: "4px 8px" }}>
          {([
            ["all", "전체"],
            ["호우", "호우만"],
            ["태풍", "태풍만"],
            ["대설·한파", "대설·한파"],
            ["special", "★특별재난"],
            ["y2023", "2023년"],
            ["y2022", "2022년"],
          ] as [FilterMode, string][]).map(([k, label]) => (
            <button key={k}
              className={filter === k ? "active" : ""}
              onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        <div className="kmap-wrap" ref={containerRef}>
          {isLoading && <div className="spinner">그래프 로딩 중...</div>}
          <svg ref={svgRef} className="kmap-svg" />
          <div className="kmap-legend">
            <div className="item"><span className="dot" style={{ background: "#e03838" }} /> 사건</div>
            <div className="item"><span className="dot" style={{ background: "#22b0d8" }} /> 재난유형</div>
            <div className="item"><span className="dot" style={{ background: "#28c870" }} /> 지역</div>
            <div className="item"><span className="dot" style={{ background: "#8855d8" }} /> 데이터소스</div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--muted)" }}>
              드래그·줌·노드클릭 가능
            </div>
          </div>
          <div ref={tooltipRef} className="kmap-tooltip" style={{ display: "none" }} />
        </div>
      </div>

      {selected && (
        <div className="side-panel">
          <div className="side-panel-header">
            <h3>{selected.label}</h3>
            <button className="close-btn" onClick={() => setSelected(null)}>×</button>
          </div>
          <div className="side-panel-body">
            <dl className="kv">
              <dt>타입</dt><dd>{selected.type}</dd>
              <dt>ID</dt><dd>{selected.id}</dd>
              {selected.year && <><dt>연도</dt><dd>{selected.year}</dd></>}
              {selected.disaster_type && <><dt>재난유형</dt><dd>{selected.disaster_type}</dd></>}
              {selected.deaths != null && <><dt>사망/실종</dt><dd>{selected.deaths} / {selected.missing ?? 0}</dd></>}
              {selected.special && <><dt>특별재난</dt><dd>★</dd></>}
              {selected.count != null && <><dt>건수</dt><dd>{selected.count.toLocaleString()}</dd></>}
            </dl>

            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
              연결된 노드 ({neighbors.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflow: "auto" }}>
              {neighbors.map((n) => (
                <div key={n.id} style={{
                  padding: "4px 8px",
                  background: "var(--bg2)",
                  borderRadius: 4,
                  fontSize: 12,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", background: n.color,
                  }} />
                  <span>{n.label}</span>
                  <span style={{ marginLeft: "auto", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}>
                    {n.type}
                  </span>
                </div>
              ))}
            </div>

            {selected.type === "event" && (
              <div style={{ marginTop: 16 }}>
                <Link to={`/events/${selected.id}`}>→ 사건 상세 페이지로 이동</Link>
              </div>
            )}
            {selected.type === "datasource" && (
              <div style={{ marginTop: 16 }}>
                <Link to="/explorer">→ 데이터 탐색기에서 조회</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
