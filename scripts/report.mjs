#!/usr/bin/env node
// Generates a Markdown change report for the last N days (default 7; use --days 14 for fortnightly)
// into reports/ and docs/data/reports.json. Run after build.mjs.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--days") + 1]) || 7;
const label = days >= 84 ? "Quarterly" : days === 14 ? "Fortnightly" : days === 7 ? "Weekly" : `${days}-day`;

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
const reviewHorizon = days >= 84 ? 90 : 30;
const reviewsDue = adrs.filter((a) => a.review_by && new Date(a.review_by) <= new Date(now.getTime() + reviewHorizon * 86400000) && a.status === "accepted");

// Decision lead time: first commit (proposal) to last status flip for accepted ADRs
const leadTimes = adrs.filter((a) => a.status === "accepted" && a.history.length >= 1)
  .map((a) => ({ id: a.id, days: Math.max(0, Math.round((new Date(a.updated) - new Date(a.created)) / 86400000)) }));
const avgLead = leadTimes.length ? Math.round(leadTimes.reduce((s2, l) => s2 + l.days, 0) / leadTimes.length) : 0;

// Radar snapshot for quarterly reports
let radarBlock = "";
try {
  const { entries } = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/data/radar.json"), "utf8"));
  if (days >= 84 && entries.length) {
    const rings = ["adopt", "trial", "assess", "hold"];
    radarBlock = "\n## Tech radar snapshot\n" + rings.map((r) => {
      const in_ = entries.filter((e) => e.ring === r);
      return `- **${r}**: ${in_.length ? in_.map((e) => `${e.id} ${e.title}`).join("; ") : "none"}`;
    }).join("\n") + "\n";
  }
} catch { /* radar.json optional */ }

const row = (a) => `| ${a.id} | ${a.title} | ${a.status} | ${domainName[a.domain] ?? a.domain} | ${a.product_names.join(", ")} | ${a.impact} |`;
const head = `| ADR | Title | Status | Domain | Products | Impact |\n|---|---|---|---|---|---|`;

const md = `# ${label} ADR change report

**Period:** ${iso(since)} to ${iso(now)}  
**Register size:** ${adrs.length} ADRs (${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(", ")})

## Headline

- ${created.length} new ADR(s), ${updated.length} amended, ${inWindow.length} commit(s) touching the register.
- ${proposedStale.length} proposal(s) open for more than 30 days.
- ${reviewsDue.length} ADR(s) due for review within ${reviewHorizon} days.\n- Average decision lead time (accepted): ${avgLead} day(s) across ${leadTimes.length} ADR(s).

## New this period
${created.length ? head + "\n" + created.map(row).join("\n") : "_None_"}

## Amended this period
${updated.length ? head + "\n" + updated.map(row).join("\n") : "_None_"}

## Commit log
${inWindow.length ? inWindow.map((c) => `- ${c.date.slice(0, 10)} · ${c.adr} · ${c.subject} _(${c.author}, ${c.sha})_`).join("\n") : "_No changes_"}

## Attention needed
${proposedStale.length ? "**Stale proposals**\n" + proposedStale.map((a) => `- ${a.id} ${a.title} (proposed ${a.date})`).join("\n") : "_No stale proposals_"}

${reviewsDue.length ? "**Reviews due**\n" + reviewsDue.map((a) => `- ${a.id} ${a.title} (review by ${a.review_by}, owner: ${a.owner})`).join("\n") : "_No reviews due_"}
${radarBlock}

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
