#!/usr/bin/env node
// Generates a Markdown change report for the last N days (default 7; use --days 14 for fortnightly)
// into reports/ and docs/data/reports.json. Run after build.mjs.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--days") + 1]) || 7;
const label = days === 14 ? "Fortnightly" : days === 7 ? "Weekly" : `${days}-day`;

const { adrs } = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/adrs.json"), "utf8"));
const { changes } = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/changes.json"), "utf8"));
const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/taxonomy.json"), "utf8"));
const domainName = Object.fromEntries(taxonomy.domains.map((d) => [d.id, d.name]));

const now = new Date();
const since = new Date(now.getTime() - days * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);

const inWindow = changes.filter((c) => new Date(c.date) >= since);
const touched = [...new Set(inWindow.map((c) => c.adr))].map((id) => adrs.find((a) => a.id === id));
const created = touched.filter((a) => new Date(a.created) >= since);
const updated = touched.filter((a) => new Date(a.created) < since);
const byStatus = Object.fromEntries(taxonomy.statuses.map((s) => [s.id, adrs.filter((a) => a.status === s.id).length]));
const proposedStale = adrs.filter((a) => a.status === "proposed" && (now - new Date(a.date)) / 86400000 > 30);
const reviewsDue = adrs.filter((a) => {
  const m = a.body.match(/Review date:\s*(\d{4}-\d{2}-\d{2})/);
  return m && new Date(m[1]) <= new Date(now.getTime() + 30 * 86400000);
});

const row = (a) => `| ${a.id} | ${a.title} | ${a.status} | ${domainName[a.domain] ?? a.domain} | ${a.product_names.join(", ")} | ${a.impact} |`;
const head = `| ADR | Title | Status | Domain | Products | Impact |\n|---|---|---|---|---|---|`;

const md = `# ${label} ADR change report

**Period:** ${iso(since)} to ${iso(now)}  
**Register size:** ${adrs.length} ADRs (${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(", ")})

## Headline

- ${created.length} new ADR(s), ${updated.length} amended, ${inWindow.length} commit(s) touching the register.
- ${proposedStale.length} proposal(s) open for more than 30 days.
- ${reviewsDue.length} ADR(s) due for review within 30 days.

## New this period
${created.length ? head + "\n" + created.map(row).join("\n") : "_None_"}

## Amended this period
${updated.length ? head + "\n" + updated.map(row).join("\n") : "_None_"}

## Commit log
${inWindow.length ? inWindow.map((c) => `- ${c.date.slice(0, 10)} · ${c.adr} · ${c.subject} _(${c.author}, ${c.sha})_`).join("\n") : "_No changes_"}

## Attention needed
${proposedStale.length ? "**Stale proposals**\n" + proposedStale.map((a) => `- ${a.id} ${a.title} (proposed ${a.date})`).join("\n") : "_No stale proposals_"}

${reviewsDue.length ? "**Reviews due**\n" + reviewsDue.map((a) => `- ${a.id} ${a.title}`).join("\n") : "_No reviews due_"}

## Coverage by domain
${taxonomy.domains.map((d) => `- ${d.name}: ${adrs.filter((a) => a.domain === d.id).length} ADR(s); unmapped products: ${d.products.filter((p) => !adrs.some((a) => a.products.includes(p.id))).map((p) => p.name).join(", ") || "none"}`).join("\n")}
`;

fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
const file = `reports/${iso(now)}-${label.toLowerCase()}.md`;
fs.writeFileSync(path.join(ROOT, file), md);

const idx = path.join(ROOT, "docs/data/reports.json");
const existing = fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, "utf8")) : [];
existing.unshift({ file, label, from: iso(since), to: iso(now), created: created.length, updated: updated.length, markdown: md });
fs.writeFileSync(idx, JSON.stringify(existing.slice(0, 52), null, 1));
console.log(`✔ wrote ${file}`);
