import argparse
from datetime import datetime
from pathlib import Path

import yaml

from . import filters, sources
from .storage import Store, write_jobs_csv


def load_config(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def main(argv=None):
    p = argparse.ArgumentParser(prog="jobscraper", description="Filtered job board scraper")
    p.add_argument("-c", "--config", default="config.yaml")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run", help="fetch, filter, store new matches")
    ex = sub.add_parser("export", help="dump stored jobs to CSV")
    ex.add_argument("-o", "--output")
    args = p.parse_args(argv)

    cfg = load_config(args.config)
    storage_cfg = cfg.get("storage", {})
    store = Store(storage_cfg.get("db_path", "jobs.db"))
    export_dir = Path(storage_cfg.get("export_dir", "exports"))

    if args.cmd == "run":
        print("Fetching...")
        jobs = sources.fetch_all(cfg.get("sources", {}))
        matched = filters.apply(jobs, cfg.get("filters", {}))
        new = store.save(matched)
        print(f"{len(jobs)} fetched, {len(matched)} matched, {len(new)} new")
        for j in new:
            print(f"- {j.title} @ {j.company} [{j.location or 'n/a'}] {j.url}")
        if new:
            out = export_dir / f"new_{datetime.now():%Y%m%d_%H%M%S}.csv"
            write_jobs_csv(out, new)
    else:
        out = args.output or export_dir / "all_jobs.csv"
        n = store.export_csv(out)
        print(f"Wrote {n} jobs to {out}")


if __name__ == "__main__":
    main()
