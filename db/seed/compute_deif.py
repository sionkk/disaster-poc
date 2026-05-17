"""DEIF 이상탐지 규칙 자동 계산.

규칙:
  RULE_01 — 기상경보 후 30분 내 CBS 발송 지연 (warning 데이터 있을 때)
  RULE_05 — 사건 시작일로부터 첫 대피 CBS 발송까지 24시간 초과 지연
  RULE_06 — 기상경보 발령됐으나 대피명령 CBS 미발송
  RULE_07 — 사망 5명 이상 사건의 대피 CBS 비율 30% 미만
  RULE_08 — 야간(22-05시) CBS 50건 이상 중 대피 비율 40% 미만
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn


def insert_alert(cur, event_id, rule, severity, title, detail, delay_min=None):
    cur.execute(
        """
        INSERT INTO deif_alerts
          (event_id, rule_code, severity, title, detail, delay_minutes)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (event_id, rule, severity, title, detail, delay_min),
    )


def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM deif_alerts")
            cur.execute("SELECT event_id, started_at FROM events ORDER BY started_at")
            events = cur.fetchall()

            for eid, started_at in events:
                # RULE_01: 경보 후 CBS 발송 지연
                cur.execute(
                    """
                    SELECT w.id,
                           EXTRACT(EPOCH FROM (
                               (SELECT MIN(issued_at) FROM cbs_messages
                                WHERE event_id=%s AND tier='TIER1_핵심재난'
                                  AND issued_at > w.issued_at)
                               - w.issued_at
                           ))/60 AS delay_min
                    FROM weather_warnings w
                    WHERE w.event_id=%s AND w.warning_level='경보'
                    """,
                    (eid, eid),
                )
                for wrn_id, delay in cur.fetchall():
                    if delay and delay > 30:
                        d = int(delay)
                        insert_alert(
                            cur, eid, "RULE_01", "CRITICAL", "CBS 발송 지연",
                            f"경보 후 {d}분 경과 후 최초 CBS 발송 (기준 30분)", d,
                        )
                        total += 1

                # RULE_05: 사건 시작일부터 첫 대피 CBS 발송까지 24시간 초과
                cur.execute(
                    "SELECT MIN(issued_at) FROM cbs_messages WHERE event_id=%s AND has_evacuation=TRUE",
                    (eid,),
                )
                first_evac = cur.fetchone()[0]
                if first_evac and started_at:
                    started_dt = datetime.combine(
                        started_at, datetime.min.time()
                    ).replace(tzinfo=first_evac.tzinfo)
                    delta_h = (first_evac - started_dt).total_seconds() / 3600
                    if delta_h > 24:
                        h = int(delta_h)
                        insert_alert(
                            cur, eid, "RULE_05", "HIGH", "대피 CBS 발송 지연",
                            f"사건 시작일 후 {h}h 경과하여 최초 대피 CBS 발송 (기준 24h)",
                            int(delta_h * 60),
                        )
                        total += 1

                # RULE_06: 경보 있는데 대피명령 CBS 없음
                cur.execute(
                    "SELECT COUNT(*) FROM weather_warnings WHERE event_id=%s AND warning_level='경보'",
                    (eid,),
                )
                if cur.fetchone()[0] > 0:
                    cur.execute(
                        "SELECT COUNT(*) FROM cbs_messages WHERE event_id=%s AND has_evacuation",
                        (eid,),
                    )
                    if cur.fetchone()[0] == 0:
                        insert_alert(
                            cur, eid, "RULE_06", "CRITICAL", "CBS 대피명령 누락",
                            "기상경보 발령되었으나 대피명령 CBS 미발송",
                        )
                        total += 1

            # RULE_07: 사망 5+ 사건의 대피 CBS 비율 30% 미만
            cur.execute(
                """
                SELECT e.event_id, e.deaths,
                       (SELECT COUNT(*) FROM cbs_messages c WHERE c.event_id=e.event_id),
                       (SELECT COUNT(*) FROM cbs_messages c WHERE c.event_id=e.event_id AND c.has_evacuation)
                FROM events e
                WHERE e.deaths >= 5
                """
            )
            for eid, deaths, total_cbs, evac_cbs in cur.fetchall():
                if total_cbs > 0 and (evac_cbs * 100.0 / total_cbs) < 30.0:
                    ratio = round(evac_cbs * 100.0 / total_cbs, 1)
                    insert_alert(
                        cur, eid, "RULE_07", "HIGH", "대피 CBS 비율 저조",
                        f"사망 {deaths}명 사건이나 대피 CBS 비율 {ratio}% (기준 30%)",
                    )
                    total += 1

            # RULE_08: 야간(22-05시) CBS 50건+ 중 대피 비율 40% 미만
            cur.execute(
                """
                SELECT event_id,
                       COUNT(*) FILTER (WHERE has_evacuation AND
                           (EXTRACT(HOUR FROM issued_at) BETWEEN 22 AND 23
                            OR EXTRACT(HOUR FROM issued_at) < 5)) AS night_evac,
                       COUNT(*) FILTER (WHERE
                           EXTRACT(HOUR FROM issued_at) BETWEEN 22 AND 23
                           OR EXTRACT(HOUR FROM issued_at) < 5) AS night_total
                FROM cbs_messages
                WHERE event_id IS NOT NULL
                GROUP BY event_id
                HAVING COUNT(*) FILTER (WHERE
                           EXTRACT(HOUR FROM issued_at) BETWEEN 22 AND 23
                           OR EXTRACT(HOUR FROM issued_at) < 5) >= 50
                """
            )
            for eid, night_evac, night_total in cur.fetchall():
                if night_total > 0 and (night_evac * 100.0 / night_total) < 40.0:
                    ratio = round(night_evac * 100.0 / night_total, 1)
                    insert_alert(
                        cur, eid, "RULE_08", "MEDIUM", "야간 대피 CBS 부족",
                        f"야간(22-05시) CBS {night_total}건 중 대피 안내 {night_evac}건 ({ratio}%)",
                    )
                    total += 1

        conn.commit()
    print(f"✅ deif_alerts: {total}건")


if __name__ == "__main__":
    main()
