#!/usr/bin/env node
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { runScrape } from "./jobs.js";
import { jobsToCsv } from "./csv.js";
import { ROLE_PRESETS, LOCATION_PRESETS } from "./presets.js";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}

const list = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

function printHelp(): void {
  console.log(`
Job listing scraper

Usage:
  npm run cli -- --keywords "python,data engineer" [--locations "remote,europe"]
                  [--exclude "intern,director"] [--min-salary 80000] [--max-age 14]
                  [--remote-only] [--title-only] [--require-salary]
                  [--greenhouse stripe,figma] [--lever netflix]
                  [--out jobs.csv]

  npm run cli -- --list-presets

Options:
  --keywords <a,b>       Posting must match at least one (title + description).
  --exclude <a,b>        Reject postings containing any of these.
  --locations <a,b>      Location must contain one of these (default: any).
  --min-salary <n>       Minimum yearly salary; postings with no salary listed still pass.
  --require-salary       Drop postings that don't list a salary.
  --max-age <days>       Ignore postings older than this.
  --remote-only          Only remote postings.
  --title-only           Match keywords against the title only.
  --greenhouse <slugs>   Extra Greenhouse company boards.
  --lever <slugs>        Extra Lever company boards.
  --no-remotive | --no-remoteok | --no-arbeitnow   Skip a built-in board.
  --out <file>           Output CSV path (default ./output/jobs-<timestamp>.csv).
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (args["list-presets"]) {
    console.log("Roles:", ROLE_PRESETS.join(", "));
    console.log("Locations:", LOCATION_PRESETS.join(", "));
    return;
  }

  const results = await runScrape({
    filters: {
      includeKeywords: list(args.keywords),
      excludeKeywords: list(args.exclude),
      titleOnly: !!args["title-only"],
      locations: list(args.locations),
      remoteOnly: !!args["remote-only"],
      minSalary: args["min-salary"] ? parseInt(args["min-salary"], 10) : 0,
      requireSalary: !!args["require-salary"],
      maxAgeDays: args["max-age"] ? parseInt(args["max-age"], 10) : 0
    },
    sources: {
      remotive: !args["no-remotive"],
      remoteok: !args["no-remoteok"],
      arbeitnow: !args["no-arbeitnow"],
      greenhouse: list(args.greenhouse),
      lever: list(args.lever)
    },
    onProgress: (msg) => console.log(`[progress] ${msg}`),
    onError: (msg) => console.error(`[error] ${msg}`),
    onJob: (j) => console.log(`[found] ${j.title} — ${j.company} — ${j.location || "n/a"}`)
  });

  console.log(`\nDone. ${results.length} unique matching postings.`);
  const outPath = args.out ?? `output/jobs-${Date.now()}.csv`;
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, jobsToCsv(results), "utf8");
  console.log(`Saved to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
