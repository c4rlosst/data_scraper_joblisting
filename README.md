# data_scraper_joblisting

Pulls postings from public job board APIs, filters them against your criteria,
and stores new matches in SQLite with CSV export.

## Sources
- Remotive, RemoteOK, Arbeitnow (public APIs)
- Any company on Greenhouse or Lever (add the slug in the config)

## Usage
```
pip install -r requirements.txt
cp config.example.yaml config.yaml   # edit your filters
python -m jobscraper run             # fetch, filter, store, print new matches
python -m jobscraper export -o all.csv
```

Each `run` prints only jobs not seen before and writes them to
`exports/new_<timestamp>.csv`. Run it on a schedule (cron) to keep tracking.

## Filters (`config.yaml`)
Include/exclude keywords, title-only matching, location substrings,
remote-only, minimum salary (USD/year), and maximum posting age.
Jobs with no salary listed pass unless `require_salary` is set.

## Tests
```
python -m pytest
```
