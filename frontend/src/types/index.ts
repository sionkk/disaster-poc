export interface EventSummary {
  event_id: string;
  year: number;
  name: string;
  disaster_type: string;
  started_at: string;
  ended_at: string;
  regions: string[];
  keywords: string[];
  deaths: number;
  missing: number;
  property_bil: number;
  special_disaster: boolean;
  cbs_total: number;
  cbs_tier1: number;
  cbs_evacuation: number;
  warning_count: number;
  deif_alerts: number;
  deif_critical: number;
}

export interface EventDetail extends EventSummary {
  deif_alerts_list: DeifAlert[];
  cbs_summary: {
    total: number;
    tier1: number;
    tier2: number;
    evacuation: number;
  };
}

export interface TimelineItem {
  time: string;
  type: "warning" | "cbs";
  tier: string | null;
  severity: string | null;
  title: string;
  content: string;
  location: string | null;
  has_evacuation: boolean;
}

export interface TimelineResponse {
  event: EventSummary;
  timeline: TimelineItem[];
}

export interface DeifAlert {
  id: number;
  event_id: string;
  rule_code: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  detail: string;
  delay_minutes: number | null;
  detected_at: string;
}

export interface VulnerabilityZone {
  id: number;
  zone_type: string;
  zone_name: string;
  address: string | null;
  region_sido: string | null;
  region_sgg: string | null;
  lat: number | null;
  lon: number | null;
  grade: string | null;
  risk_type: string | null;
  evacuate_place: string | null;
  evacuate_criteria: string | null;
}

export interface StatsSummary {
  total_events: number;
  total_deaths: number;
  total_missing: number;
  total_cbs: number;
  total_cbs_tier1: number;
  total_cbs_evacuation: number;
  total_property_bil: number;
  special_disaster_count: number;
  total_deif_alerts: number;
  deif_critical: number;
}

export interface YearStat {
  year: number;
  event_count: number;
  deaths: number;
  missing: number;
  property_bil: number;
  cbs_tier1: number;
}

export interface TypeStat {
  disaster_type: string;
  event_count: number;
  deaths: number;
  missing: number;
  property_bil: number;
}
