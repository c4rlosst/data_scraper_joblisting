import type { JobListing } from "./types.js";

const COLUMNS: (keyof JobListing)[] = [
  "title",
  "company",
  "location",
  "remote",
  "salaryMin",
  "salaryMax",
  "postedAt",
  "source",
  "url",
  "scrapedAt"
];

function escapeCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function jobsToCsv(list: JobListing[]): string {
  const header = COLUMNS.join(",");
  const rows = list.map((j) => COLUMNS.map((c) => escapeCell(j[c])).join(","));
  return [header, ...rows].join("\n");
}
