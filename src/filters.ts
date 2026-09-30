import type { JobFilters, JobListing } from "./types.js";

const DAY_MS = 86_400_000;

function containsAny(text: string, words: string[]): boolean {
  const t = text.toLowerCase();
  return words.some((w) => w && t.includes(w.toLowerCase()));
}

export function matchesFilters(job: JobListing, f: JobFilters, now = Date.now()): boolean {
  const searchable = f.titleOnly ? job.title : `${job.title} ${job.description}`;
  if (f.includeKeywords.length && !containsAny(searchable, f.includeKeywords)) return false;
  if (f.excludeKeywords.length && containsAny(`${job.title} ${job.description}`, f.excludeKeywords)) return false;

  if (f.remoteOnly && !job.remote) return false;

  if (f.locations.length) {
    // a remote job with no stated location counts as "anywhere"
    const anywhere = job.remote && !job.location.trim();
    if (!anywhere && !containsAny(job.location, f.locations)) return false;
  }

  const top = job.salaryMax ?? job.salaryMin;
  if (top === undefined) {
    if (f.requireSalary) return false;
  } else if (top < (f.minSalary ?? 0)) {
    return false;
  }

  if (f.maxAgeDays && job.postedAt) {
    if (Date.parse(job.postedAt) < now - f.maxAgeDays * DAY_MS) return false;
  }
  return true;
}
