#!/usr/bin/env node
// Converts a GitHub issue created from the ADR issue form into a new adr/NNNN-slug.md file.
// Expects ISSUE_JSON env var containing the issue payload.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const issue = JSON.parse(process.env.ISSUE_JSON);
const body = issue.body || "";

// Issue forms render as "### Label\n\nvalue" blocks
const field = (label) => {
  const m = body.match(new RegExp(`### ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[^\\n]*\\n+([\\s\\S]*?)(?=\\n### |$)`));
  return m ? m[1].trim().replace(/^_No response_$/, "") : "";
};
const list = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

const existing = fs.readdirSync(path.join(ROOT, "adr")).map((f) => Number(f.slice(0, 4))).filter(Number.isFinite);
const next = String(Math.max(0, ...existing) + 1).padStart(4, "0");
const title = issue.title.replace(/^\[ADR\]\s*/i, "").trim();
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const today = new Date().toISOString().slice(0, 10);

const options = field("Options considered").split("\n").filter(Boolean).map((l) => `| ${l.replace(/^[-*]\s*/, "")} |  |  |`).join("\n");

const md = `---
id: ADR-${next}
title: ${JSON.stringify(title)}
status: proposed
date: ${today}
decided_by: Architecture Review Board
owner: ${JSON.stringify(field("Owner (name and role)"))}
domain: ${field("Domain")}
products: [${list(field("Products (comma separated ids from taxonomy.yml)")).join(", ")}]
platforms: [${list(field("Platforms (comma separated ids, optional)")).join(", ")}]
decision_type: ${field("Decision type")}
impact: ${field("Impact")}
gxp_relevant: ${field("Touches GxP / GDP controlled systems?") === "true"}
security_review: ${field("Decision type") === "security" ? "pending" : "not-required"}
supersedes: []
superseded_by: null
tags: []
links:
  - { label: Originating issue, url: ${JSON.stringify(issue.html_url)} }
---

## Context

${field("Context")}

## Decision

${field("Decision")}

## Options considered

| Option | Summary | Why not / why |
|---|---|---|
${options || "|  |  |  |"}

## Consequences

${field("Consequences") || "**Positive**\n\n**Negative / accepted trade-offs**\n\n**Follow-ups**"}

## Compliance and review

- GxP / GDP impact: ${field("Touches GxP / GDP controlled systems?") === "true" ? "to be assessed" : "none"}
- Security review: ${field("Decision type") === "security" ? "pending" : "not required"}
- Review date: 
`;

const file = `adr/${next}-${slug}.md`;
fs.writeFileSync(path.join(ROOT, file), md);
fs.appendFileSync(process.env.GITHUB_OUTPUT || "/dev/null", `file=${file}\nid=ADR-${next}\n`);
console.log(`✔ created ${file}`);
