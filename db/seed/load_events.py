import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from app.database import get_conn
from app.config import DATA_DIR

PATH = os.path.join(DATA_DIR, "events.json")


def main():
    events = json.load(open(PATH, encoding="utf-8"))
    with get_conn() as conn:
        with conn.cursor() as cur:
            for ev in events:
                cur.execute(
                    """
                    INSERT INTO events
                      (event_id,year,name,disaster_type,started_at,ended_at,
                       regions,keywords,deaths,missing,property_bil,special_disaster)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (event_id) DO UPDATE SET
                      name=EXCLUDED.name, deaths=EXCLUDED.deaths,
                      property_bil=EXCLUDED.property_bil
                    """,
                    (
                        ev["event_id"], ev["year"], ev["name"], ev["type"],
                        ev["start"], ev["end"], ev["regions"], ev["keywords"],
                        ev["deaths"], ev["missing"], ev["property_bil"],
                        ev["special_disaster"],
                    ),
                )
        conn.commit()
    print(f"✅ events: {len(events)}건")


if __name__ == "__main__":
    main()
