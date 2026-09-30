# data_scraper_joblisting

Pulls job postings from public job board APIs and filters them to exactly what
you're looking for — keywords, location, salary, remote, and posting age. Use
it from a web UI (results stream in live, download as CSV) or the CLI. There's
no database; results live in memory for the session and export to CSV.

## Sources

- **Remotive**, **RemoteOK**, **Arbeitnow** — public job board APIs
- **Greenhouse** and **Lever** company boards — add any company's slug
  (`boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`)

These are official/public endpoints, so no browser automation or anti-bot
workarounds are involved. If a board is down or blocked, it's reported as an
error in the UI and the remaining sources still run.

## Setup

### Option A: GitHub Codespaces

GitHub → **Code** → **Codespaces** → **Create codespace**. The devcontainer runs
`npm install` for you; then `npm run server` and open the forwarded port 3000.

### Option B: Locally

```bash
npm install
```

Both `npm run server` and `npm run cli` compile the TypeScript with `tsc` and
run the plain compiled JS. Requires Node 18+.

## Web UI

```bash
npm run server
```

Open http://localhost:3000, set your filters, pick sources, and click
**Start search**. Matches appear as each source finishes; pause/resume any time
and download the results as CSV. The page is an installable PWA
(**Add to Home Screen**), though the server still has to be reachable.

## CLI

```bash
npm run cli -- --list-presets

npm run cli -- --keywords "python,data engineer" --locations "remote,europe" \
  --exclude "intern,director" --min-salary 80000 --max-age 14 --out jobs.csv

# Extra company boards
npm run cli -- --keywords "backend" --greenhouse stripe,figma --lever netflix
```

Run `npm run cli -- --help` for every option.

## Filters

| Filter | Behaviour |
| --- | --- |
| Keywords | Posting must match at least one (title + description, or title only) |
| Exclude | Any hit in title/description drops the posting |
| Locations | Substring match on the posting's location; empty = anywhere |
| Remote only | Keep only remote postings |
| Min salary | Yearly, compared against the posting's top listed figure |
| Salary listed | Drop postings with no salary at all |
| Max age | Ignore postings older than N days |

Most boards don't publish salaries, so postings without one pass the salary
filter unless "Salary listed" is on. Results are deduplicated by URL, so a
posting cross-listed on several boards shows once.

CSV columns: `title, company, location, remote, salaryMin, salaryMax, postedAt, source, url, scrapedAt`.

## Development

```bash
npm test          # builds, then runs the node:test suite
npm run typecheck
```
