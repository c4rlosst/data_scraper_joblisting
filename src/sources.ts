import type { JobListing, SourceSelection } from "./types.js";

const TIMEOUT_MS = 20_000;
const HEADERS = { "User-Agent": "data-scraper-joblisting/0.1 (personal job search)" };

// Board APIs return loosely-typed JSON; fields are read defensively below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

async function getJson(url: string): Promise<Json> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

export function stripHtml(text: unknown): string {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isoOrUndefined(value: unknown): string | undefined {
  if (!value) return undefined;
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Best-effort parse of strings like "$80k - $120k" or "90,000-110,000 USD". */
export function parseSalaryText(text?: string): { min?: number; max?: number } {
  if (!text) return {};
  const nums: number[] = [];
  for (const m of text.matchAll(/(\d[\d,.]*)\s*([kK])?/g)) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isNaN(n)) continue;
    if (m[2]) n *= 1000;
    if (n >= 1000) nums.push(Math.round(n));
  }
  if (!nums.length) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const now = () => new Date().toISOString();

export async function fetchRemotive(): Promise<JobListing[]> {
  const data = await getJson("https://remotive.com/api/remote-jobs");
  return (data.jobs ?? []).map((j: Json): JobListing => {
    const sal = parseSalaryText(j.salary);
    return {
      source: "remotive",
      externalId: String(j.id),
      title: j.title ?? "",
      company: j.company_name ?? "",
      url: j.url ?? "",
      location: j.candidate_required_location ?? "",
      remote: true,
      salaryMin: sal.min,
      salaryMax: sal.max,
      postedAt: isoOrUndefined(j.publication_date),
      description: stripHtml(j.description),
      scrapedAt: now()
    };
  });
}

export async function fetchRemoteOk(): Promise<JobListing[]> {
  const data: Json[] = await getJson("https://remoteok.com/api");
  return data
    .filter((j) => j && typeof j === "object" && j.id) // first element is a legal notice
    .map((j): JobListing => ({
      source: "remoteok",
      externalId: String(j.id),
      title: j.position ?? "",
      company: j.company ?? "",
      url: j.url ?? "",
      location: j.location || "Remote",
      remote: true,
      salaryMin: j.salary_min || undefined,
      salaryMax: j.salary_max || undefined,
      postedAt: isoOrUndefined(j.date),
      description: `${stripHtml(j.description)} ${(j.tags ?? []).join(" ")}`.trim(),
      scrapedAt: now()
    }));
}

export async function fetchArbeitnow(): Promise<JobListing[]> {
  const out: JobListing[] = [];
  for (const page of [1, 2, 3]) {
    const data = await getJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    const rows: Json[] = data.data ?? [];
    if (!rows.length) break;
    for (const j of rows) {
      out.push({
        source: "arbeitnow",
        externalId: String(j.slug),
        title: j.title ?? "",
        company: j.company_name ?? "",
        url: j.url ?? "",
        location: j.location ?? "",
        remote: !!j.remote,
        postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : undefined,
        description: `${stripHtml(j.description)} ${(j.tags ?? []).join(" ")}`.trim(),
        scrapedAt: now()
      });
    }
  }
  return out;
}

export async function fetchGreenhouse(slug: string): Promise<JobListing[]> {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
  return (data.jobs ?? []).map((j: Json): JobListing => {
    const location = j.location?.name ?? "";
    return {
      source: `greenhouse:${slug}`,
      externalId: String(j.id),
      title: j.title ?? "",
      company: slug,
      url: j.absolute_url ?? "",
      location,
      remote: /remote/i.test(location),
      postedAt: isoOrUndefined(j.updated_at),
      // Greenhouse returns the description entity-escaped HTML
      description: stripHtml(stripHtml(j.content)),
      scrapedAt: now()
    };
  });
}

export async function fetchLever(slug: string): Promise<JobListing[]> {
  const data: Json[] = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  return data.map((j): JobListing => {
    const location = j.categories?.location ?? "";
    return {
      source: `lever:${slug}`,
      externalId: String(j.id),
      title: j.text ?? "",
      company: slug,
      url: j.hostedUrl ?? "",
      location,
      remote: /remote/i.test(location) || j.workplaceType === "remote",
      postedAt: isoOrUndefined(j.createdAt),
      description: j.descriptionPlain ?? "",
      scrapedAt: now()
    };
  });
}

export interface SourceTask {
  name: string;
  run: () => Promise<JobListing[]>;
}

export function buildTasks(sel: SourceSelection): SourceTask[] {
  const tasks: SourceTask[] = [];
  if (sel.remotive) tasks.push({ name: "remotive", run: fetchRemotive });
  if (sel.remoteok) tasks.push({ name: "remoteok", run: fetchRemoteOk });
  if (sel.arbeitnow) tasks.push({ name: "arbeitnow", run: fetchArbeitnow });
  for (const slug of sel.greenhouse) tasks.push({ name: `greenhouse:${slug}`, run: () => fetchGreenhouse(slug) });
  for (const slug of sel.lever) tasks.push({ name: `lever:${slug}`, run: () => fetchLever(slug) });
  return tasks;
}
