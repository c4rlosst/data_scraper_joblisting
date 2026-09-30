from datetime import datetime, timedelta, timezone

from jobscraper.filters import apply, matches
from jobscraper.models import Job
from jobscraper.sources import _parse_salary_text
from jobscraper.storage import Store

NOW = datetime(2026, 1, 31, tzinfo=timezone.utc)


def job(**kw):
    base = dict(source="t", external_id="1", title="Python Developer", company="Acme",
                url="http://x", location="Remote - Europe", remote=True,
                posted_at=NOW - timedelta(days=2), description="Build APIs")
    base.update(kw)
    return Job(**base)


def test_include_and_exclude_keywords():
    cfg = {"include_keywords": ["python"], "exclude_keywords": ["intern"]}
    assert matches(job(), cfg, NOW)
    assert not matches(job(title="Go Developer", description=""), cfg, NOW)
    assert not matches(job(title="Python Intern"), cfg, NOW)


def test_title_only():
    cfg = {"include_keywords": ["django"], "title_only": True}
    assert not matches(job(description="django everywhere"), cfg, NOW)


def test_location_and_remote_only():
    assert matches(job(), {"locations": ["europe"]}, NOW)
    assert not matches(job(location="USA Only"), {"locations": ["europe"]}, NOW)
    assert not matches(job(remote=False), {"remote_only": True}, NOW)


def test_salary_rules():
    assert matches(job(), {"min_salary": 100000}, NOW)  # unknown salary passes
    assert not matches(job(), {"min_salary": 100000, "require_salary": True}, NOW)
    assert not matches(job(salary_max=50000), {"min_salary": 100000}, NOW)
    assert matches(job(salary_max=150000), {"min_salary": 100000}, NOW)


def test_max_age():
    old = job(posted_at=NOW - timedelta(days=60))
    assert not matches(old, {"max_age_days": 30}, NOW)
    assert len(apply([old, job()], {"max_age_days": 30}, NOW)) == 1


def test_salary_text_parsing():
    assert _parse_salary_text("$80k - $120k") == (80000, 120000)
    assert _parse_salary_text("90,000-110,000 USD") == (90000, 110000)
    assert _parse_salary_text("") == (None, None)


def test_store_dedupes(tmp_path):
    store = Store(tmp_path / "j.db")
    assert len(store.save([job()])) == 1
    assert store.save([job()]) == []
