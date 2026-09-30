export interface JobListing {
  /** which board it came from, e.g. "remotive" or "greenhouse:stripe" */
  source: string;
  externalId: string;
  title: string;
  company: string;
  url: string;
  location: string;
  remote: boolean;
  /** yearly, USD-ish; only set when the board publishes it */
  salaryMin?: number;
  salaryMax?: number;
  postedAt?: string;
  description: string;
  scrapedAt: string;
}

export interface JobFilters {
  /** a posting must match at least one (empty = no requirement) */
  includeKeywords: string[];
  /** any hit rejects the posting */
  excludeKeywords: string[];
  /** only look for include keywords in the title */
  titleOnly?: boolean;
  /** case-insensitive substrings matched against the location (empty = any) */
  locations: string[];
  remoteOnly?: boolean;
  minSalary?: number;
  requireSalary?: boolean;
  /** 0 / undefined = no limit */
  maxAgeDays?: number;
}

export interface SourceSelection {
  remotive: boolean;
  remoteok: boolean;
  arbeitnow: boolean;
  /** board slugs, e.g. "stripe" from boards.greenhouse.io/stripe */
  greenhouse: string[];
  /** board slugs, e.g. "netflix" from jobs.lever.co/netflix */
  lever: string[];
}

export interface ScrapeOptions {
  filters: JobFilters;
  sources: SourceSelection;
  /** called for every posting that passes the filters */
  onJob?: (j: JobListing) => void;
  onProgress?: (msg: string) => void;
  /** called with the raw (pre-filter) posting count of each successful source */
  onFetched?: (count: number) => void;
  /** called when a single source fails */
  onError?: (msg: string) => void;
  /** called once each source finishes (or fails) */
  onSourceComplete?: () => void;
  /** checked before starting each source — loop blocks (polling) while true */
  isPaused?: () => boolean;
}

export type JobStatus = "queued" | "running" | "paused" | "done" | "error";

export interface ScrapeJob {
  id: string;
  status: JobStatus;
  options: Pick<ScrapeOptions, "filters" | "sources">;
  results: JobListing[];
  /** number of sources to run */
  total: number;
  processed: number;
  /** raw postings fetched before filtering */
  fetched: number;
  currentSource?: string;
  /** per-source failures, so one bad board doesn't hide the rest */
  errors: string[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}
