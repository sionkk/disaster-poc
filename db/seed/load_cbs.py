import csv
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn
from app.config import DATA_DIR

PATH = os.path.join(DATA_DIR, "cbs_filtered_tiered.csv")
EVAC_KW = ["대피", "피하", "긴급대피", "대피명령", "소개령"]
WARN_KW = ["경보", "주의보"]


def parse_dt(s):
    for fmt in ["%Y/%m/%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"]:
        try:
            return datetime.strptime(s.strip(), fmt)
        except Exception:
            pass
    return None


def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            # 재실행 시 중복 방지를 위해 기존 데이터 삭제
            cur.execute("DELETE FROM cbs_messages")
            batch = []
            with open(PATH, encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    dt = parse_dt(row.get("create_date", ""))
                    if not dt:
                        continue
                    msg = row.get("msg", "")
                    batch.append(
                        (
                            row["event_id"], row.get("event_name", ""),
                            row.get("disaster_type", ""), dt,
                            row.get("location_name", ""), msg[:1000],
                            row.get("send_platform", "cbs"),
                            row.get("tier", "TIER2_재난관련"),
                            any(k in msg for k in EVAC_KW),
                            any(k in msg for k in WARN_KW),
                        )
                    )
                    if len(batch) >= 500:
                        cur.executemany(
                            """
                            INSERT INTO cbs_messages
                              (event_id,event_name,disaster_type,issued_at,
                               location_name,content,send_platform,tier,
                               has_evacuation,has_warning)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            batch,
                        )
                        total += len(batch)
                        batch = []
            if batch:
                cur.executemany(
                    """
                    INSERT INTO cbs_messages
                      (event_id,event_name,disaster_type,issued_at,
                       location_name,content,send_platform,tier,
                       has_evacuation,has_warning)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    batch,
                )
                total += len(batch)
        conn.commit()
    print(f"✅ cbs_messages: {total:,}건")


if __name__ == "__main__":
    main()
