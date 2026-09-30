import csv
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    key TEXT PRIMARY KEY,
    source TEXT, title TEXT, company TEXT, url TEXT, location TEXT,
    remote INTEGER, salary_min INTEGER, salary_max INTEGER,
    posted_at TEXT, first_seen TEXT
)
"""
COLUMNS = ["source", "title", "company", "location", "remote",
           "salary_min", "salary_max", "posted_at", "first_seen", "url"]


class Store:
    def __init__(self, path):
        self.conn = sqlite3.connect(path)
        self.conn.execute(SCHEMA)

    def save(self, jobs):
        """Insert unseen jobs; return only the newly added ones."""
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        new = []
        for j in jobs:
            cur = self.conn.execute(
                "INSERT OR IGNORE INTO jobs VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (j.key, j.source, j.title, j.company, j.url, j.location,
                 int(j.remote), j.salary_min, j.salary_max,
                 j.posted_at.isoformat() if j.posted_at else None, now),
            )
            if cur.rowcount:
                new.append(j)
        self.conn.commit()
        return new

    def export_csv(self, path, since=None):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        query = f"SELECT {', '.join(COLUMNS)} FROM jobs"
        args = ()
        if since:
            query += " WHERE first_seen >= ?"
            args = (since,)
        rows = self.conn.execute(query + " ORDER BY posted_at DESC", args).fetchall()
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(COLUMNS)
            w.writerows(rows)
        return len(rows)


def write_jobs_csv(path, jobs):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        for j in jobs:
            w.writerow([j.source, j.title, j.company, j.location, int(j.remote),
                        j.salary_min, j.salary_max,
                        j.posted_at.isoformat() if j.posted_at else "", "", j.url])
