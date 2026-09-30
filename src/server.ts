import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROLE_PRESETS, LOCATION_PRESETS, BOARD_SUGGESTIONS } from "./presets.js";
import { createJob, getJob, listJobs, pauseJob, resumeJob } from "./jobs.js";
import { jobsToCsv } from "./csv.js";
import type { JobFilters, SourceSelection } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];

app.get("/api/presets", (_req, res) => {
  res.json({ roles: ROLE_PRESETS, locations: LOCATION_PRESETS, boards: BOARD_SUGGESTIONS });
});

app.post("/api/jobs", (req, res) => {
  const body = req.body as {
    filters?: Partial<JobFilters>;
    sources?: Partial<SourceSelection>;
  };

  const sources: SourceSelection = {
    remotive: !!body.sources?.remotive,
    remoteok: !!body.sources?.remoteok,
    arbeitnow: !!body.sources?.arbeitnow,
    greenhouse: strList(body.sources?.greenhouse),
    lever: strList(body.sources?.lever)
  };
  const anySource = sources.remotive || sources.remoteok || sources.arbeitnow || sources.greenhouse.length || sources.lever.length;
  if (!anySource) {
    res.status(400).json({ error: "pick at least one source" });
    return;
  }

  const f = body.filters ?? {};
  const filters: JobFilters = {
    includeKeywords: strList(f.includeKeywords),
    excludeKeywords: strList(f.excludeKeywords),
    titleOnly: !!f.titleOnly,
    locations: strList(f.locations),
    remoteOnly: !!f.remoteOnly,
    minSalary: Number(f.minSalary) || 0,
    requireSalary: !!f.requireSalary,
    maxAgeDays: Number(f.maxAgeDays) || 0
  };

  const job = createJob({ filters, sources });
  res.json({ id: job.id });
});

app.get("/api/jobs", (_req, res) => {
  res.json(
    listJobs().map((j) => ({
      id: j.id,
      status: j.status,
      total: j.total,
      processed: j.processed,
      resultCount: j.results.length,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt
    }))
  );
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "not found" });
    return;
  }
  // descriptions are only needed for filtering; keep the polled payload small
  res.json({ ...job, results: job.results.map((r) => ({ ...r, description: "" })) });
});

app.post("/api/jobs/:id/pause", (req, res) => {
  if (!pauseJob(req.params.id)) {
    res.status(400).json({ error: "job isn't running (already paused/finished, or doesn't exist)" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/jobs/:id/resume", (req, res) => {
  if (!resumeJob(req.params.id)) {
    res.status(400).json({ error: "job isn't paused" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/jobs/:id/results.csv", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).send("not found");
    return;
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="jobs-${job.id}.csv"`);
  res.send(jobsToCsv(job.results));
});

app.listen(PORT, () => {
  console.log(`Job scraper UI running at http://localhost:${PORT}`);
});
