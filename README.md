# World Courier ADR Register

Architecture Decision Records for World Courier (Cencora). Markdown in `adr/`, validated against
`taxonomy.yml`, published to GitHub Pages from `docs/`.

## How it works

| Concern | Mechanism |
|---|---|
| Source of truth | `adr/NNNN-slug.md` with YAML front matter (MADR style) |
| Estate mapping | `taxonomy.yml` lists every domain, product and platform; build fails on unknown references |
| Raise a new ADR | GitHub issue form → Action drafts `adr/NNNN-*.md` and opens a draft PR |
| Approval | CODEOWNERS on `adr/`; status moves `proposed → accepted` only via reviewed PR |
| Search, filter, sort | Static site in `docs/` reading `docs/data/*.json` (no server, no database) |
| Change reporting | Weekly (Mon) and fortnightly (1st, 15th) Action commits `reports/*.md`; visible in the Reports tab |
| Audit trail | Git history per ADR shown in the detail drawer and the Changes tab |

## Setup (once)

1. Create the repo, push this content, set **Settings → Pages → Source: GitHub Actions**.
2. Edit `CONFIG.repo` in `docs/app.js` and the team handle in `.github/CODEOWNERS`.
3. Enable Actions. The first push to `main` builds and deploys.

## Day to day

```bash
npm install
npm run build      # validate + generate docs/data
npm run serve      # local preview at http://localhost:3000
npm run report -- --days 14
```

## ADR lifecycle

`proposed` → `accepted` | `rejected` → `superseded` (set `superseded_by`) | `deprecated`

Superseding: create the new ADR with `supersedes: [ADR-00xx]`, then set the old one's
`status: superseded` and `superseded_by` in the same PR.

## Adding a product or platform

Add it to `taxonomy.yml` in a PR. The Coverage view will show it as "no decisions on record"
until an ADR references it, which is the point.
