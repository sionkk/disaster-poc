import type {
  EventSummary,
  EventDetail,
  TimelineResponse,
  DeifAlert,
  VulnerabilityZone,
  StatsSummary,
  YearStat,
  TypeStat,
} from "../types";

const BASE = ""; // vite dev proxy → /api forwards to backend

async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

export const api = {
  events: (params?: { year?: number; type?: string; special?: boolean; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.year != null) q.set("year", String(params.year));
    if (params?.type) q.set("type", params.type);
    if (params?.special != null) q.set("special", String(params.special));
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return jget<EventSummary[]>(`/api/events${qs ? "?" + qs : ""}`);
  },
  event: (id: string) => jget<EventDetail>(`/api/events/${id}`),
  timeline: (id: string) => jget<TimelineResponse>(`/api/events/${id}/timeline`),
  deif: (id: string) => jget<DeifAlert[]>(`/api/events/${id}/deif`),
  vulnerability: (type?: string, sido?: string) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (sido) q.set("sido", sido);
    q.set("limit", "500");
    return jget<VulnerabilityZone[]>(`/api/vulnerability?${q}`);
  },
  vulnerabilityTypes: () => jget<{ zone_type: string; count: number }[]>(`/api/vulnerability/types`),
  statsSummary: () => jget<StatsSummary>(`/api/stats/summary`),
  statsByYear: () => jget<YearStat[]>(`/api/stats/by-year`),
  statsByType: () => jget<TypeStat[]>(`/api/stats/by-type`),
  cbsByEvent: () =>
    jget<{ event_id: string; name: string; year: number; cbs_tier1: number; cbs_total: number }[]>(
      `/api/stats/cbs-by-event`,
    ),

  // explorer
  explorerTables: () =>
    jget<{ table: string; count: number; last_loaded: string | null }[]>(`/api/explorer/tables`),
  explorerQuery: (table: string, params: Record<string, string | number | boolean | undefined>) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && v !== null) q.set(k, String(v));
    });
    return jget<{ total: number; rows: any[]; limit: number; offset: number }>(
      `/api/explorer/${table}?${q}`,
    );
  },
  explorerSearch: (q: string, limit = 50) =>
    jget<{
      query: string;
      count: number;
      results: { table: string; id: any; event_id: string | null; summary: string; matched_field: string }[];
    }>(`/api/explorer/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  // knowledge map
  knowledgeMap: () =>
    jget<{ nodes: KMapNode[]; links: KMapLink[] }>(`/api/knowledge-map`),
  knowledgeMapEvent: (eventId: string) =>
    jget<{ nodes: KMapNode[]; links: KMapLink[] }>(`/api/knowledge-map/event/${eventId}`),

  // lineage
  lineage: () => jget<LineageResponse>(`/api/lineage`),
  lineageTable: (table: string) => jget<TableLineage>(`/api/lineage/table/${table}`),
};

export interface KMapNode {
  id: string;
  type: "event" | "disaster_type" | "region" | "datasource";
  label: string;
  size: number;
  color: string;
  year?: number;
  disaster_type?: string;
  special?: boolean;
  deaths?: number;
  missing?: number;
  count?: number;
}

export interface KMapLink {
  source: string | KMapNode;
  target: string | KMapNode;
  value: number;
  kind: string;
}

export interface PipelineStep {
  step: number;
  name: string;
  type: "source" | "derived" | "api";
  desc: string;
  output_table: string;
  record_count: number;
  files: string[];
  filter_desc?: string;
  status: string;
  next_action?: string;
}

export interface LineageResponse {
  pipeline: PipelineStep[];
  source_files: { source_file: string; count: number; table_name: string }[];
  quality: Record<string, Record<string, any>>;
  next_actions: { title: string; desc: string; blocks: string[] }[];
}

export interface TableLineage {
  table: string;
  total: number;
  columns: { column_name: string; data_type: string; is_nullable: string }[];
  source_files: { source_file: string; count: number }[];
  date_range: { earliest: string | null; latest: string | null } | null;
}
