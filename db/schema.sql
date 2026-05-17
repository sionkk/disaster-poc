-- PostGIS (없으면 경고 후 계속)
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'PostGIS 없음 — 공간 인덱스 비활성화';
END $$;

-- 사건 마스터 (32건)
CREATE TABLE IF NOT EXISTS events (
    event_id         VARCHAR(20)   PRIMARY KEY,
    year             SMALLINT      NOT NULL,
    name             VARCHAR(100)  NOT NULL,
    disaster_type    VARCHAR(30)   NOT NULL,
    started_at       DATE          NOT NULL,
    ended_at         DATE          NOT NULL,
    regions          TEXT[]        NOT NULL,
    keywords         TEXT[]        NOT NULL,
    deaths           SMALLINT      DEFAULT 0,
    missing          SMALLINT      DEFAULT 0,
    property_bil     NUMERIC(10,1) DEFAULT 0,
    special_disaster BOOLEAN       DEFAULT FALSE,
    created_at       TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_year    ON events(year);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(disaster_type);
CREATE INDEX IF NOT EXISTS idx_events_started ON events(started_at);

-- CBS 긴급재난문자 (11,515건)
CREATE TABLE IF NOT EXISTS cbs_messages (
    id             BIGSERIAL    PRIMARY KEY,
    event_id       VARCHAR(20)  REFERENCES events(event_id),
    event_name     VARCHAR(100),
    disaster_type  VARCHAR(30),
    issued_at      TIMESTAMPTZ,
    location_name  TEXT,
    content        TEXT         NOT NULL,
    send_platform  VARCHAR(20)  DEFAULT 'cbs',
    tier           VARCHAR(30)  NOT NULL DEFAULT 'TIER2_재난관련',
    has_evacuation BOOLEAN      DEFAULT FALSE,
    has_warning    BOOLEAN      DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_cbs_event    ON cbs_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_cbs_issued   ON cbs_messages(issued_at);
CREATE INDEX IF NOT EXISTS idx_cbs_tier     ON cbs_messages(tier);

-- 기상 특보
CREATE TABLE IF NOT EXISTS weather_warnings (
    id            BIGSERIAL    PRIMARY KEY,
    event_id      VARCHAR(20)  REFERENCES events(event_id),
    issued_at     TIMESTAMPTZ,
    warning_type  VARCHAR(30),
    warning_level VARCHAR(10),
    region_name   TEXT,
    content       TEXT,
    source_file   VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_wrn_event  ON weather_warnings(event_id);
CREATE INDEX IF NOT EXISTS idx_wrn_issued ON weather_warnings(issued_at);

-- 취약지역
CREATE TABLE IF NOT EXISTS vulnerability_zones (
    id                BIGSERIAL    PRIMARY KEY,
    zone_type         VARCHAR(30)  NOT NULL,
    zone_name         TEXT,
    address           TEXT,
    region_sido       VARCHAR(20),
    region_sgg        VARCHAR(30),
    lat               NUMERIC(10,7),
    lon               NUMERIC(10,7),
    grade             VARCHAR(10),
    risk_type         VARCHAR(50),
    evacuate_place    TEXT,
    evacuate_criteria TEXT,
    area_m2           NUMERIC(15,2),
    source_file       VARCHAR(100),
    extra_json        JSONB
);
CREATE INDEX IF NOT EXISTS idx_vuln_type ON vulnerability_zones(zone_type);
CREATE INDEX IF NOT EXISTS idx_vuln_sido ON vulnerability_zones(region_sido);

-- DEIF 이상탐지
CREATE TABLE IF NOT EXISTS deif_alerts (
    id            BIGSERIAL    PRIMARY KEY,
    event_id      VARCHAR(20)  REFERENCES events(event_id),
    rule_code     VARCHAR(20)  NOT NULL,
    severity      VARCHAR(10)  NOT NULL,
    title         TEXT         NOT NULL,
    detail        TEXT,
    delay_minutes INTEGER,
    detected_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deif_event    ON deif_alerts(event_id);
CREATE INDEX IF NOT EXISTS idx_deif_severity ON deif_alerts(severity);

-- 강수량 (KMA API 키 등록 후 수집)
CREATE TABLE IF NOT EXISTS rainfall_obs (
    id            BIGSERIAL    PRIMARY KEY,
    event_id      VARCHAR(20)  REFERENCES events(event_id),
    station_id    INTEGER,
    obs_time      TIMESTAMPTZ,
    precipitation NUMERIC(6,1),
    temperature   NUMERIC(5,1),
    wind_speed    NUMERIC(5,1)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rain_stn_time ON rainfall_obs(station_id, obs_time);

-- 요약 뷰
CREATE OR REPLACE VIEW v_event_summary AS
SELECT
    e.event_id, e.year, e.name, e.disaster_type, e.started_at, e.ended_at,
    e.regions, e.keywords, e.deaths, e.missing, e.property_bil,
    e.special_disaster, e.created_at,
    COUNT(DISTINCT c.id)                                          AS cbs_total,
    COUNT(DISTINCT c.id) FILTER (WHERE c.tier='TIER1_핵심재난')   AS cbs_tier1,
    COUNT(DISTINCT c.id) FILTER (WHERE c.has_evacuation)          AS cbs_evacuation,
    COUNT(DISTINCT w.id)                                          AS warning_count,
    COUNT(DISTINCT da.id)                                         AS deif_alerts,
    COUNT(DISTINCT da.id) FILTER (WHERE da.severity='CRITICAL')   AS deif_critical
FROM events e
LEFT JOIN cbs_messages c     ON c.event_id = e.event_id
LEFT JOIN weather_warnings w ON w.event_id = e.event_id
LEFT JOIN deif_alerts da     ON da.event_id = e.event_id
GROUP BY e.event_id;
