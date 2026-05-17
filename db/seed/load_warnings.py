import csv
import io
import os
import json
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn
from app.config import DATA_DIR, RAW_DIR

events = json.load(open(os.path.join(DATA_DIR, "events.json"), encoding="utf-8"))
EVENT_RANGES = [
    (e["start"].replace("-", ""), e["end"].replace("-", ""), e["event_id"])
    for e in events
]

FILES = [
    os.path.join(RAW_DIR, "참고자료/재난문자/기상청특보통보문.csv"),
    os.path.join(RAW_DIR, "참고자료/재난문자/기상청_특보통보문.csv"),
]


def find_event(dt_str):
    if not dt_str or len(dt_str) < 8:
        return None
    d = str(dt_str)[:8].replace("-", "")
    for s, e, eid in EVENT_RANGES:
        if s <= d <= e:
            return eid
    return None


def read_csv(path):
    raw = open(path, "rb").read()
    for enc in ["utf-8-sig", "cp949", "euc-kr"]:
        try:
            return list(csv.DictReader(io.StringIO(raw.decode(enc))))
        except Exception:
            pass
    return []


def main():
    total = 0
    with get_conn() as conn:
        with conn.cursor() as cur:
            for path in FILES:
                if not os.path.exists(path):
                    print(f"  skip: {path}")
                    continue
                for row in read_csv(path):
                    issued = row.get("NDMS_PRSNTN_TM") or row.get("PRSNTN_TM", "")
                    eid = find_event(issued)
                    if not eid:
                        continue
                    title = row.get("TTL", "")
                    lvl = (
                        "경보"
                        if "경보" in title
                        else "주의보" if "주의보" in title else ""
                    )
                    typ = next(
                        (k for k in ["호우", "태풍", "대설", "강풍", "산사태"] if k in title),
                        "기타",
                    )
                    cur.execute(
                        """
                        INSERT INTO weather_warnings
                          (event_id,issued_at,warning_type,warning_level,
                           region_name,content,source_file)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            eid, issued or None, typ + lvl, lvl,
                            row.get("RLVT_ZONE", ""),
                            row.get("PRSNTN_CN", "")[:500],
                            os.path.basename(path),
                        ),
                    )
                    total += 1
        conn.commit()
    print(f"✅ weather_warnings: {total:,}건")


if __name__ == "__main__":
    main()
