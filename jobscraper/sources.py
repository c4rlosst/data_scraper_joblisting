"""Fetchers for public job board APIs. Each returns a list of Job."""
import html
import re
from datetime import datetime, timezone

import requests

from .models import Job

TIMEOUT = 20
HEADERS = {"User-Agent": "jobscraper/0.1 (personal job search)"}
_TAG_RE = re.compile(r"<[^>]+>")
_NUM_RE = re.compile(r"\d[\d,\.]*")


def _get(url, **params):
    resp = requests.get(url, params=params or None, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def strip_html(text: str) -> str:
    return html.unescape(_TAG_RE.sub(" ", text or "")).strip()


def _parse_iso(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _parse_salary_text(text):
    """Best-effort parse of strings like '$80k - $120k' or '90,000-110,000 USD'."""
    if not text:
        return None, None
    nums = []
    for m in re.finditer(r"(\d[\d,\.]*)\s*([kK])?", text):
        try:
            n = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        if m.group(2):
            n *= 1000
        if n >= 1000:
            nums.append(int(n))
    if not nums:
        return None, None
    return min(nums), max(nums)


def fetch_remotive():
    data = _get("https://remotive.com/api/remote-jobs")
    jobs = []
    for j in data.get("jobs", []):
        lo, hi = _parse_salary_text(j.get("salary"))
        jobs.append(Job(
            source="remotive",
            external_id=str(j["id"]),
            title=j.get("title", ""),
            company=j.get("company_name", ""),
            url=j.get("url", ""),
            location=j.get("candidate_required_location", ""),
            remote=True,
            salary_min=lo,
            salary_max=hi,
            posted_at=_parse_iso(j.get("publication_date")),
            description=strip_html(j.get("description", "")),
        ))
    return jobs


def fetch_remoteok():
    data = _get("https://remoteok.com/api")
    jobs = []
    for j in data:
        if not isinstance(j, dict) or "id" not in j:
            continue  # first element is a legal notice
        jobs.append(Job(
            source="remoteok",
            external_id=str(j["id"]),
            title=j.get("position", ""),
            company=j.get("company", ""),
            url=j.get("url", ""),
            location=j.get("location", "") or "Remote",
            remote=True,
            salary_min=j.get("salary_min") or None,
            salary_max=j.get("salary_max") or None,
            posted_at=_parse_iso(j.get("date")),
            description=strip_html(j.get("description", "")) + " " + " ".join(j.get("tags", [])),
        ))
    return jobs


def fetch_arbeitnow():
    jobs = []
    for page in (1, 2, 3):
        data = _get("https://www.arbeitnow.com/api/job-board-api", page=page)
        rows = data.get("data", [])
        if not rows:
            break
        for j in rows:
            created = j.get("created_at")
            jobs.append(Job(
                source="arbeitnow",
                external_id=j["slug"],
                title=j.get("title", ""),
                company=j.get("company_name", ""),
                url=j.get("url", ""),
                location=j.get("location", ""),
                remote=bool(j.get("remote")),
                posted_at=datetime.fromtimestamp(created, tz=timezone.utc) if created else None,
                description=strip_html(j.get("description", "")) + " " + " ".join(j.get("tags", [])),
            ))
    return jobs


def fetch_greenhouse(slug):
    data = _get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", content="true")
    jobs = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name", "")
        jobs.append(Job(
            source=f"greenhouse:{slug}",
            external_id=str(j["id"]),
            title=j.get("title", ""),
            company=slug,
            url=j.get("absolute_url", ""),
            location=loc,
            remote="remote" in loc.lower(),
            posted_at=_parse_iso(j.get("updated_at")),
            description=strip_html(j.get("content", "")),
        ))
    return jobs


def fetch_lever(slug):
    data = _get(f"https://api.lever.co/v0/postings/{slug}", mode="json")
    jobs = []
    for j in data:
        cats = j.get("categories") or {}
        loc = cats.get("location", "") or ""
        created = j.get("createdAt")
        jobs.append(Job(
            source=f"lever:{slug}",
            external_id=j["id"],
            title=j.get("text", ""),
            company=slug,
            url=j.get("hostedUrl", ""),
            location=loc,
            remote="remote" in loc.lower() or j.get("workplaceType") == "remote",
            posted_at=datetime.fromtimestamp(created / 1000, tz=timezone.utc) if created else None,
            description=j.get("descriptionPlain", ""),
        ))
    return jobs


def fetch_all(sources_cfg, log=print):
    """Run every enabled source; a failing source is logged and skipped."""
    tasks = []
    if sources_cfg.get("remotive"):
        tasks.append(("remotive", fetch_remotive))
    if sources_cfg.get("remoteok"):
        tasks.append(("remoteok", fetch_remoteok))
    if sources_cfg.get("arbeitnow"):
        tasks.append(("arbeitnow", fetch_arbeitnow))
    for slug in sources_cfg.get("greenhouse") or []:
        tasks.append((f"greenhouse:{slug}", lambda s=slug: fetch_greenhouse(s)))
    for slug in sources_cfg.get("lever") or []:
        tasks.append((f"lever:{slug}", lambda s=slug: fetch_lever(s)))

    jobs = []
    for name, fn in tasks:
        try:
            got = fn()
            log(f"  {name}: {len(got)} postings")
            jobs.extend(got)
        except Exception as exc:  # network/API errors shouldn't kill the run
            log(f"  {name}: failed ({exc})")
    return jobs
