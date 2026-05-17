#!/usr/bin/env python3
import subprocess
import sys
import os

scripts = [
    "load_events.py",
    "load_cbs.py",
    "load_warnings.py",
    "load_vulnerability.py",
    "compute_deif.py",
]
seed_dir = os.path.dirname(os.path.abspath(__file__))
for s in scripts:
    print(f"\n{'='*50}\n▶ {s}\n{'='*50}")
    result = subprocess.run(
        [sys.executable, os.path.join(seed_dir, s)], check=False
    )
    if result.returncode != 0:
        print(f"⚠  {s} 실패 — 계속 진행")
