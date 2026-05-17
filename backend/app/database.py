import psycopg
from psycopg.rows import dict_row
from app.config import DB_NAME, DB_USER, DB_HOST, DB_PORT

CONNSTR = f"dbname={DB_NAME} user={DB_USER} host={DB_HOST} port={DB_PORT}"


def get_conn():
    return psycopg.connect(CONNSTR)


def query(sql: str, params=None) -> list[dict]:
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()


def execute(sql: str, params=None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
        conn.commit()
