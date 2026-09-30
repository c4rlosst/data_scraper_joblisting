import type { JobListing } from "./types.js";

function keyFor(j: JobListing): string {
  const url = j.url.split("?")[0].replace(/\/+$/, "").toLowerCase();
  if (url) return `url:${url}`;
  return `tc:${j.title.trim().toLowerCase()}|${j.company.trim().toLowerCase()}`;
}

/** Same posting cross-listed on several boards (or fetched twice) collapses to one row. */
export function dedupeJobs(list: JobListing[]): JobListing[] {
  const byKey = new Map<string, JobListing>();
  for (const j of list) {
    const key = keyFor(j);
    const existing = byKey.get(key);
    const score = (x: JobListing) => Number(!!x.salaryMax || !!x.salaryMin) + Number(!!x.postedAt) + Number(!!x.location);
    if (!existing || score(j) > score(existing)) byKey.set(key, j);
  }
  return [...byKey.values()];
}
