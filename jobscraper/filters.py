from datetime import datetime, timedelta, timezone

from .models import Job


def _contains_any(text, words):
    text = text.lower()
    return any(w.lower() in text for w in words)


def matches(job: Job, cfg: dict, now=None) -> bool:
    now = now or datetime.now(timezone.utc)
    haystack = job.title if cfg.get("title_only") else f"{job.title} {job.description}"

    include = cfg.get("include_keywords") or []
    if include and not _contains_any(haystack, include):
        return False

    exclude = cfg.get("exclude_keywords") or []
    if exclude and _contains_any(f"{job.title} {job.description}", exclude):
        return False

    if cfg.get("remote_only") and not job.remote:
        return False

    locations = cfg.get("locations") or []
    if locations:
        loc = job.location.lower()
        # An empty location on a remote job is treated as "anywhere".
        if not (_contains_any(loc, locations) or (job.remote and not loc)):
            return False

    top = job.salary_max or job.salary_min
    if top is None:
        if cfg.get("require_salary"):
            return False
    elif top < (cfg.get("min_salary") or 0):
        return False

    max_age = cfg.get("max_age_days") or 0
    if max_age and job.posted_at and job.posted_at < now - timedelta(days=max_age):
        return False

    return True


def apply(jobs, cfg, now=None):
    return [j for j in jobs if matches(j, cfg, now)]
