import { randomUUID } from "node:crypto";
import { buildTasks } from "./sources.js";
import { matchesFilters } from "./filters.js";
import { dedupeJobs } from "./dedupe.js";
import type { JobListing, ScrapeJob, ScrapeOptions } from "./types.js";

const jobs = new Map<string, ScrapeJob>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Shared by the web server and the CLI. Resolves with the filtered, deduped postings. */
export async function runScrape(opts: ScrapeOptions): Promise<JobListing[]> {
  const tasks = buildTasks(opts.sources);
  const kept: JobListing[] = [];

  for (const task of tasks) {
    while (opts.isPaused?.()) await sleep(500);
    opts.onProgress?.(`Fetching ${task.name}…`);
    try {
      const fetched = await task.run();
      const matched = fetched.filter((j) => matchesFilters(j, opts.filters));
      opts.onProgress?.(`${task.name}: ${fetched.length} postings, ${matched.length} match`);
      for (const j of matched) {
        kept.push(j);
        opts.onJob?.(j);
      }
      opts.onFetched?.(fetched.length);
    } catch (err) {
      // one board being down/blocked shouldn't lose the others
      opts.onError?.(`${task.name}: ${(err as Error).message}`);
    }
    opts.onSourceComplete?.();
  }
  return dedupeJobs(kept);
}

export function getJob(id: string): ScrapeJob | undefined {
  return jobs.get(id);
}

export function listJobs(): ScrapeJob[] {
  return [...jobs.values()].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function createJob(base: Pick<ScrapeOptions, "filters" | "sources">): ScrapeJob {
  const id = randomUUID();
  const total = buildTasks(base.sources).length;
  const job: ScrapeJob = {
    id,
    status: "queued",
    options: base,
    results: [],
    total,
    processed: 0,
    fetched: 0,
    errors: [],
    startedAt: new Date().toISOString()
  };
  jobs.set(id, job);

  const raw: JobListing[] = [];
  job.status = "running";
  runScrape({
    ...base,
    onProgress: (msg) => {
      job.currentSource = msg;
    },
    onJob: (j) => {
      raw.push(j);
      job.results = dedupeJobs(raw);
    },
    onFetched: (n) => {
      job.fetched += n;
    },
    onError: (msg) => {
      job.errors.push(msg);
    },
    onSourceComplete: () => {
      job.processed += 1;
    },
    isPaused: () => job.status === "paused"
  })
    .then((final) => {
      job.results = final;
      job.status = "done";
      job.finishedAt = new Date().toISOString();
    })
    .catch((err: Error) => {
      job.status = "error";
      job.error = err.message;
      job.finishedAt = new Date().toISOString();
    });

  return job;
}

/** true if it actually paused it, false if the job wasn't running */
export function pauseJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;
  job.status = "paused";
  return true;
}

/** true if it actually resumed it, false if the job wasn't paused */
export function resumeJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "paused") return false;
  job.status = "running";
  return true;
}
