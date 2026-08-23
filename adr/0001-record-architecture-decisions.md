---
id: ADR-0001
title: Record architecture decisions as versioned ADRs in a single register
status: accepted
date: 2026-07-14
decided_by: Head of Architecture and Analysis
owner: Nathan Urquhart (Head of Architecture and Analysis)
domain: data-and-platform
products: [tap]
platforms: [github]
decision_type: process
impact: medium
gxp_relevant: true
security_review: not-required
supersedes: []
superseded_by: null
tags: [governance, practice, audit-trail]
review_by: 2027-07-14
links:
  - { label: Practice Playbook, url: "" }
---

## Context

World Courier decisions have historically lived in slide decks, Confluence comments and email threads. Audits in a GDP-regulated environment require a traceable rationale for system changes, and new joiners need to understand why the estate looks the way it does.

## Decision

We will record every significant architecture decision as a Markdown ADR in the `cencora-wc-adr-register` repository. Changes land only via pull request, reviewed by CODEOWNERS. A GitHub Pages site renders the register for search, filtering and reporting.

## Options considered

| Option | Summary | Why not / why |
|---|---|---|
| Confluence pages | Familiar, but no enforced schema, weak history | Drift and no machine-readable index |
| Spreadsheet | Good for filtering, poor for rationale | No review workflow |
| Git + Pages | Versioned, reviewable, searchable | Chosen |

## Consequences

**Positive**: full audit trail, enforced taxonomy, automated weekly change reports.

**Negative / accepted trade-offs**: non-engineers raise ADRs via an issue form rather than editing files directly.

**Follow-ups**: link tech debt register items to ADR ids.

## Compliance and review

- GxP / GDP impact: supports change control evidence
- Security review: not required
- Review date: 2027-01-14
