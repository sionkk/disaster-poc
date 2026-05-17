import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parents[2] / ".env")

DB_NAME = os.getenv("DB_NAME", "disaster_poc")
DB_USER = os.getenv("DB_USER") or os.getenv("USER") or ""
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]

DATA_DIR = os.getenv("DATA_DIR", str(Path(__file__).parents[2] / "data"))
RAW_DIR = os.getenv("RAW_DIR", str(Path(__file__).parents[2] / "data" / "raw"))
