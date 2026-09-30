import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFilters } from "./filters.js";
import { parseSalaryText } from "./sources.js";
import { dedupeJobs } from "./dedupe.js";
import type { JobFilters, JobListing } from "./types.js";

const NOW = Date.parse("2026-01-31T00:00:00Z");
const base: JobFilters = { includeKeywords: [], excludeKeywords: [], locations: [] };

function job(over: Partial<JobListing> = {}): JobListing {
  return {
    source: "t",
    externalId: "1",
    title: "Python Developer",
    company: "Acme",
    url: "http://x/1",
    location: "Remote - Europe",
    remote: true,
    postedAt: "2026-01-29T00:00:00Z",
    description: "Build APIs",
    scrapedAt: "2026-01-31T00:00:00Z",
    ...over
  };
}

test("include / exclude keywords", () => {
  const f = { ...base, includeKeywords: ["python"], excludeKeywords: ["intern"] };
  assert.ok(matchesFilters(job(), f, NOW));
  assert.ok(!matchesFilters(job({ title: "Go Developer", description: "" }), f, NOW));
  assert.ok(!matchesFilters(job({ title: "Python Intern" }), f, NOW));
});

test("title-only ignores the description", () => {
  const f = { ...base, includeKeywords: ["django"], titleOnly: true };
  assert.ok(!matchesFilters(job({ description: "django everywhere" }), f, NOW));
});

test("location and remote-only", () => {
  assert.ok(matchesFilters(job(), { ...base, locations: ["europe"] }, NOW));
  assert.ok(!matchesFilters(job({ location: "USA Only" }), { ...base, locations: ["europe"] }, NOW));
  assert.ok(matchesFilters(job({ location: "" }), { ...base, locations: ["europe"] }, NOW));
  assert.ok(!matchesFilters(job({ remote: false }), { ...base, remoteOnly: true }, NOW));
});

test("salary rules", () => {
  const f = { ...base, minSalary: 100_000 };
  assert.ok(matchesFilters(job(), f, NOW)); // no salary listed passes
  assert.ok(!matchesFilters(job(), { ...f, requireSalary: true }, NOW));
  assert.ok(!matchesFilters(job({ salaryMax: 50_000 }), f, NOW));
  assert.ok(matchesFilters(job({ salaryMax: 150_000 }), f, NOW));
});

test("max age", () => {
  const f = { ...base, maxAgeDays: 30 };
  assert.ok(!matchesFilters(job({ postedAt: "2025-11-01T00:00:00Z" }), f, NOW));
  assert.ok(matchesFilters(job(), f, NOW));
});

test("salary text parsing", () => {
  assert.deepEqual(parseSalaryText("$80k - $120k"), { min: 80_000, max: 120_000 });
  assert.deepEqual(parseSalaryText("90,000-110,000 USD"), { min: 90_000, max: 110_000 });
  assert.deepEqual(parseSalaryText(""), {});
});

test("dedupe collapses the same posting", () => {
  const out = dedupeJobs([job({ url: "http://x/1?ref=a" }), job({ url: "http://x/1", salaryMax: 90_000 })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].salaryMax, 90_000);
});
