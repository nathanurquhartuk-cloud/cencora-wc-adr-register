#!/usr/bin/env node
// Builds docs/data/adrs.json, docs/data/taxonomy.json and docs/data/changes.json
// from adr/*.md and taxonomy.yml. Fails the build on schema or taxonomy violations.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import matter from "gray-matter";
import yaml from "js-yaml";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const ADR_DIR = path.join(ROOT, "adr");
const OUT_DIR = path.join(ROOT, "docs", "data");
const VALIDATE_ONLY = process.argv.includes("--validate-only");

const taxonomy = yaml.load(fs.readFileSync(path.join(ROOT, "taxonomy.yml"), "utf8"));
const productIndex = new Map();
for (const d of taxonomy.domains) for (const p of d.products) productIndex.set(p.id, { ...p, domain: d.id });
const platformIds = new Set(taxonomy.platforms.map((p) => p.id));
const domainIds = new Set(taxonomy.domains.map((d) => d.id));
const statusIds = new Set(taxonomy.statuses.map((s) => s.id));
const decisionTypes = new Set(taxonomy.decision_types);
const impactLevels = new Set(taxonomy.impact_levels);

const REQUIRED = ["id", "title", "status", "date", "decided_by", "owner", "domain", "decision_type", "impact"];
const errors = [];
const adrs = [];

function gitHistory(file) {
  try {
    const out = execSync(`git log --follow --format=%H%x09%aI%x09%an%x09%s -- "${file}"`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    if (!out) return [];
    return out.split("\n").map((l) => {
      const [sha, date, author, subject] = l.split("\t");
      return { sha: sha.slice(0, 8), date, author, subject };
    });
  } catch {
    return [];
  }
}

for (const file of fs.readdirSync(ADR_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("0000-")).sort()) {
  const full = path.join(ADR_DIR, file);
  const { data, content } = matter(fs.readFileSync(full, "utf8"));
  const where = `adr/${file}`;

  for (const k of REQUIRED) if (data[k] === undefined || data[k] === null || data[k] === "") errors.push(`${where}: missing "${k}"`);
  if (!/^ADR-\d{4}$/.test(String(data.id))) errors.push(`${where}: id must look like ADR-0001`);
  if (!file.startsWith(String(data.id).replace("ADR-", ""))) errors.push(`${where}: filename number must match id ${data.id}`);
  if (!statusIds.has(data.status)) errors.push(`${where}: unknown status "${data.status}"`);
  if (!domainIds.has(data.domain)) errors.push(`${where}: unknown domain "${data.domain}"`);
  if (!decisionTypes.has(data.decision_type)) errors.push(`${where}: unknown decision_type "${data.decision_type}"`);
  if (!impactLevels.has(data.impact)) errors.push(`${where}: unknown impact "${data.impact}"`);
  const products = data.products ?? [];
  const platforms = data.platforms ?? [];
  if (products.length + platforms.length === 0) errors.push(`${where}: must map to at least one product or platform`);
  for (const p of products) if (!productIndex.has(p)) errors.push(`${where}: unknown product "${p}" (add it to taxonomy.yml)`);
  for (const p of platforms) if (!platformIds.has(p)) errors.push(`${where}: unknown platform "${p}"`);
  if (data.status === "superseded" && !data.superseded_by) errors.push(`${where}: superseded ADRs need superseded_by`);
  const dateStr = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) errors.push(`${where}: date must be YYYY-MM-DD`);

  const history = gitHistory(`adr/${file}`);
  const section = (name) => {
    const m = content.match(new RegExp(`##\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i"));
    return m ? m[1].trim() : "";
  };

  adrs.push({
    id: data.id,
    title: data.title,
    status: data.status,
    date: dateStr,
    decided_by: data.decided_by,
    owner: data.owner,
    domain: data.domain,
    products,
    product_names: products.map((p) => productIndex.get(p)?.name ?? p),
    platforms,
    decision_type: data.decision_type,
    impact: data.impact,
    gxp_relevant: Boolean(data.gxp_relevant),
    security_review: data.security_review ?? "not-required",
    supersedes: data.supersedes ?? [],
    superseded_by: data.superseded_by ?? null,
    tags: data.tags ?? [],
    links: (data.links ?? []).filter((l) => l && l.url),
    file: `adr/${file}`,
    summary: section("Decision").split("\n")[0].slice(0, 280),
    context: section("Context"),
    decision: section("Decision"),
    consequences: section("Consequences"),
    body: content,
    created: history.length ? history[history.length - 1].date : dateStr,
    updated: history.length ? history[0].date : dateStr,
    history,
  });
}

// Cross-reference checks
const ids = new Set(adrs.map((a) => a.id));
const dup = adrs.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
for (const d of dup) errors.push(`duplicate id ${d}`);
for (const a of adrs) {
  for (const s of a.supersedes) if (!ids.has(s)) errors.push(`${a.file}: supersedes unknown ${s}`);
  if (a.superseded_by && !ids.has(a.superseded_by)) errors.push(`${a.file}: superseded_by unknown ${a.superseded_by}`);
}

if (errors.length) {
  console.error(`\n✖ ${errors.length} validation error(s):\n`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`✔ ${adrs.length} ADRs validated against taxonomy`);
if (VALIDATE_ONLY) process.exit(0);

// Change feed: every commit touching an ADR, newest first
const changes = adrs
  .flatMap((a) => a.history.map((h) => ({ ...h, adr: a.id, title: a.title, status: a.status, domain: a.domain })))
  .sort((x, y) => y.date.localeCompare(x.date));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "adrs.json"), JSON.stringify({ generated: new Date().toISOString(), adrs }, null, 1));
fs.writeFileSync(path.join(OUT_DIR, "taxonomy.json"), JSON.stringify(taxonomy, null, 1));
fs.writeFileSync(path.join(OUT_DIR, "changes.json"), JSON.stringify({ generated: new Date().toISOString(), changes }, null, 1));
console.log(`✔ wrote docs/data/{adrs,taxonomy,changes}.json`);
