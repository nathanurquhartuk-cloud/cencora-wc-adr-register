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

## Review reminders

Give any accepted ADR a `review_by: YYYY-MM-DD` in its front matter. Every Monday the **Review reminders** workflow opens a GitHub issue (label `adr-review`, titled `Review due: ADR-NNNN`) for anything due within 30 days, so the owner gets a native GitHub notification. Re-affirm (bump `review_by`), amend, or supersede - then close the issue.

## Tech radar

Set `radar_ring` (adopt | trial | assess | hold) and `radar_quadrant` (techniques | platforms | tools | languages) together on an ADR and it appears as a blip on the site's **Radar** tab. Clicking a blip opens the decision that justifies the position - ring moves happen only via a superseding ADR, so radar history is git history. `docs/data/radar.json` is regenerated on every build.

## Reporting cadence

`report.yml` runs weekly (Mondays), fortnightly (1st and 15th) and quarterly (1 Jan / Apr / Jul / Oct). The quarterly report adds decision lead time, a radar snapshot, reviews due in the coming quarter and coverage deltas - built for the quarterly architecture review pack. Reports land in `reports/` and render on the site's Reports tab.

## Tech debt linkage

List debt register ids in `debt_refs` on an ADR; they show in the detail drawer so decisions and the debt they create or retire stay connected.

## Notifications

- **GitHub native**: watch the repo, or rely on review issues and CODEOWNERS review requests.
- **Teams / Slack**: add a `TEAMS_WEBHOOK_URL` repository secret and the **Notify on ADR change** workflow posts to the channel on every merged ADR change. Without the secret it silently skips.
- **RSS**: subscribe to `https://github.com/nathanurquhartuk-cloud/cencora-wc-adr-register/commits/main/adr.atom` for a feed of register changes.
