#!/usr/bin/env node
// Lists ADRs whose review_by falls within the next 30 days (or is overdue).
// Output: one line per ADR, tab separated: id, title, review_by, owner, file
// Used by .github/workflows/review-reminders.yml to open GitHub issues.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const { adrs } = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/adrs.json"), "utf8"));
const horizon = new Date(Date.now() + 30 * 86400000);

for (const a of adrs) {
  if (!a.review_by || a.status !== "accepted") continue;
  if (new Date(a.review_by) <= horizon) {
    console.log([a.id, a.title, a.review_by, a.owner, a.file].join("\t"));
  }
}
