/* ADR Register — vanilla JS, no build step. Data comes from data/*.json produced by scripts/build.mjs */
const CONFIG = {
  repo: "https://github.com/nathanurquhartuk-cloud/cencora-wc-adr-register", // change to the real repo
  branch: "main",
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "");
const IMPACT_RANK = { high: 3, medium: 2, low: 1 };
const STATUS_RANK = { proposed: 1, accepted: 2, superseded: 3, deprecated: 4, rejected: 5 };

let ADRS = [], TAX = null, CHANGES = [], REPORTS = [];
const state = { q: "", status: new Set(), products: new Set(), domains: new Set(), platforms: new Set(), types: new Set(), impact: new Set(), flags: new Set(), sort: "date:desc", view: "register", days: 7 };

/* ---------- bootstrap ---------- */
async function load() {
  const [a, t, c, r] = await Promise.all([
    fetch("data/adrs.json").then((x) => x.json()),
    fetch("data/taxonomy.json").then((x) => x.json()),
    fetch("data/changes.json").then((x) => x.json()).catch(() => ({ changes: [] })),
    fetch("data/reports.json").then((x) => x.json()).catch(() => []),
  ]);
  ADRS = a.adrs; TAX = t; CHANGES = c.changes; REPORTS = r;
  $("#generated").textContent = "built " + fmt(a.generated);
  $("#raise").href = `${CONFIG.repo}/issues/new?template=adr.yml`;
  $("#repo").href = CONFIG.repo;
  readHash();
  buildFacets();
  bind();
  render();
}

/* ---------- taxonomy helpers ---------- */
const productMap = () => new Map(TAX.domains.flatMap((d) => d.products.map((p) => [p.id, { ...p, domain: d }])));
const domainMap = () => new Map(TAX.domains.map((d) => [d.id, d]));

/* ---------- filtering and search ---------- */
function tokens(s) { return s.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean); }
function score(adr, qTokens) {
  if (!qTokens.length) return 1;
  const hay = {
    id: adr.id.toLowerCase(), title: adr.title.toLowerCase(), tags: adr.tags.join(" ").toLowerCase(),
    products: (adr.products.join(" ") + " " + adr.product_names.join(" ")).toLowerCase(), body: adr.body.toLowerCase(),
  };
  let s = 0;
  for (const t of qTokens) {
    if (hay.id.includes(t)) s += 10;
    else if (hay.title.includes(t)) s += 6;
    else if (hay.tags.includes(t) || hay.products.includes(t)) s += 4;
    else if (hay.body.includes(t)) s += 1;
    else return 0; // every token must hit somewhere
  }
  return s;
}
function filtered() {
  const qt = tokens(state.q);
  return ADRS.map((a) => ({ a, s: score(a, qt) }))
    .filter(({ a, s }) => s > 0
      && (!state.status.size || state.status.has(a.status))
      && (!state.domains.size || state.domains.has(a.domain))
      && (!state.products.size || a.products.some((p) => state.products.has(p)))
      && (!state.platforms.size || a.platforms.some((p) => state.platforms.has(p)))
      && (!state.types.size || state.types.has(a.decision_type))
      && (!state.impact.size || state.impact.has(a.impact))
      && (!state.flags.has("gxp") || a.gxp_relevant)
      && (!state.flags.has("security") || a.security_review === "pending"))
    .sort((x, y) => {
      if (qt.length && y.s !== x.s) return y.s - x.s;
      const [k, dir] = state.sort.split(":"); const m = dir === "asc" ? 1 : -1;
      const v = (o) => k === "impact" ? IMPACT_RANK[o.impact] : k === "status" ? STATUS_RANK[o.status] : o[k];
      return (v(x.a) > v(y.a) ? 1 : v(x.a) < v(y.a) ? -1 : 0) * m;
    })
    .map(({ a }) => a);
}

/* ---------- facets ---------- */
function check(setName, value, label, n) {
  const on = state[setName].has(value);
  return `<label class="${n === 0 ? "is-zero" : ""}"><input type="checkbox" data-set="${setName}" value="${esc(value)}" ${on ? "checked" : ""}/> ${esc(label)} <span class="n">${n}</span></label>`;
}
function buildFacets() {
  const count = (fn) => ADRS.filter(fn).length;
  $("#facet-status .facet-body").innerHTML = TAX.statuses.map((s) => check("status", s.id, s.name, count((a) => a.status === s.id))).join("");
  $("#facet-domain .facet-body").innerHTML = TAX.domains.map((d) => `
    <div class="domain">
      <label class="domain-name"><input type="checkbox" data-set="domains" value="${d.id}" ${state.domains.has(d.id) ? "checked" : ""}/> ${esc(d.name)} <span class="n">${count((a) => a.domain === d.id)}</span></label>
      <div class="products">${d.products.map((p) => check("products", p.id, p.name, count((a) => a.products.includes(p.id)))).join("")}</div>
    </div>`).join("");
  $("#facet-platform .facet-body").innerHTML = TAX.platforms.map((p) => check("platforms", p.id, p.name, count((a) => a.platforms.includes(p.id)))).join("");
  $("#facet-type .facet-body").innerHTML = TAX.decision_types.map((t) => check("types", t, t, count((a) => a.decision_type === t))).join("");
  $("#facet-impact .facet-body").innerHTML = TAX.impact_levels.map((t) => check("impact", t, t, count((a) => a.impact === t))).join("");
  $("#facet-flags .facet-body").innerHTML = check("flags", "gxp", "GxP / GDP relevant", count((a) => a.gxp_relevant)) + check("flags", "security", "Security review pending", count((a) => a.security_review === "pending"));
}

/* ---------- register ---------- */
function renderRegister() {
  const rows = filtered(); const dm = domainMap();
  $("#count-register").textContent = ADRS.length;
  $("#result-line").innerHTML = `<strong>${rows.length}</strong> of ${ADRS.length} decisions${state.q ? ` matching “${esc(state.q)}”` : ""}`;
  $("#empty").hidden = rows.length > 0;
  $("#ledger tbody").innerHTML = rows.map((a) => `
    <tr data-id="${a.id}" tabindex="0">
      <td class="id">${a.id}</td>
      <td><div class="title">${esc(a.title)}</div><span class="summary">${esc(a.summary)}</span>
          ${a.tags.length ? `<div class="tags">${a.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}</td>
      <td><span class="status ${a.status}">${a.status}</span>${a.superseded_by ? `<span class="flag">→ ${a.superseded_by}</span>` : ""}</td>
      <td class="domain-cell"><b>${esc(dm.get(a.domain)?.name ?? a.domain)}</b>${esc(a.product_names.join(", "))}${a.gxp_relevant ? '<span class="flag">GxP</span>' : ""}</td>
      <td><span class="impact ${a.impact}">${a.impact}</span></td>
      <td class="date">${fmt(a.date)}</td>
      <td class="date">${fmt(a.updated)}</td>
    </tr>`).join("");
  const [k, dir] = state.sort.split(":");
  $$("#ledger th").forEach((th) => th.classList.toggle("sorted", th.dataset.sort === k) || th.classList.toggle("asc", th.dataset.sort === k && dir === "asc"));
}

/* ---------- changes ---------- */
function renderChanges() {
  const since = Date.now() - state.days * 86400000;
  const win = CHANGES.filter((c) => new Date(c.date).getTime() >= since);
  const ids = [...new Set(win.map((c) => c.adr))];
  const touched = ids.map((id) => ADRS.find((a) => a.id === id)).filter(Boolean);
  const created = touched.filter((a) => new Date(a.created).getTime() >= since);
  const stale = ADRS.filter((a) => a.status === "proposed" && (Date.now() - new Date(a.date)) / 86400000 > 30);
  const from = new Date(since);
  $("#changes-line").innerHTML = `<strong>${win.length}</strong> change${win.length === 1 ? "" : "s"} across <strong>${ids.length}</strong> decision${ids.length === 1 ? "" : "s"} since ${fmt(from)}`;
  $("#kpis").innerHTML = [
    ["New decisions", created.length, ""], ["Amended", touched.length - created.length, ""],
    ["Proposed (open)", ADRS.filter((a) => a.status === "proposed").length, ""],
    ["Stale proposals >30d", stale.length, stale.length ? "warn" : ""],
    ["Accepted total", ADRS.filter((a) => a.status === "accepted").length, ""],
  ].map(([l, v, cls]) => `<div class="kpi ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
  if (!win.length) { $("#timeline").innerHTML = `<li class="day">Nothing changed in this window. Widen it or check the last report.</li>`; return; }
  const byDay = {};
  for (const c of win) (byDay[c.date.slice(0, 10)] ??= []).push(c);
  $("#timeline").innerHTML = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([day, items]) => `
    <li class="day">${fmt(day)}</li>` + items.map((c) => {
      const a = ADRS.find((x) => x.id === c.adr); const isNew = a && c.sha === a.history[a.history.length - 1]?.sha;
      return `<li class="${isNew ? "is-new" : ""}"><div class="when">${c.date.slice(11, 16)} · ${isNew ? "created" : "amended"}</div>
        <div class="what"><a href="#adr=${c.adr}">${c.adr}</a>${esc(c.title)}</div>
        <div class="meta">${esc(c.subject)} · ${esc(c.author)} · <span class="mono">${c.sha}</span></div></li>`;
    }).join("")).join("");
}

/* ---------- coverage (estate map) ---------- */
function renderCoverage() {
  $("#estate").innerHTML = TAX.domains.map((d) => {
    const cells = d.products.map((p) => {
      const hits = ADRS.filter((a) => a.products.includes(p.id));
      const silent = hits.length === 0;
      return `<button class="cell ${silent ? "silent" : ""}" data-product="${p.id}" title="${silent ? "No decisions recorded" : hits.map((h) => h.id).join(", ")}">
        <span class="name">${esc(p.name)}</span>
        <span class="bar">${hits.length ? hits.map((h) => `<span class="${h.status}"></span>`).join("") : "<span></span>"}</span>
        <span class="n">${silent ? "no decisions on record" : `${hits.length} ADR${hits.length > 1 ? "s" : ""} · ${hits.filter((h) => h.status === "accepted").length} accepted`}</span>
      </button>`;
    }).join("");
    const covered = d.products.filter((p) => ADRS.some((a) => a.products.includes(p.id))).length;
    return `<div class="domain-row"><div><h3>${esc(d.name)}</h3><p>${esc(d.description)}</p><div class="stat">${covered}/${d.products.length} products covered · ${ADRS.filter((a) => a.domain === d.id).length} ADRs</div></div><div class="cells">${cells}</div></div>`;
  }).join("");
}

/* ---------- reports ---------- */
function renderReports() {
  $("#reports").innerHTML = REPORTS.length ? REPORTS.map((r, i) => `
    <details class="report" ${i === 0 ? "open" : ""}><summary>${esc(r.label)} report <span class="mono">${r.from} → ${r.to}</span> <span class="mono">${r.created} new · ${r.updated} amended</span></summary>
    <div class="md">${md(r.markdown)}</div></details>`).join("")
    : `<div class="empty"><p>No reports yet. They appear here after the first scheduled run, or trigger “ADR change report” in Actions.</p></div>`;
}

/* ---------- drawer ---------- */
function openAdr(id) {
  const a = ADRS.find((x) => x.id === id); if (!a) return;
  const dm = domainMap();
  $("#drawer-id").textContent = a.id;
  $("#drawer-edit").href = `${CONFIG.repo}/edit/${CONFIG.branch}/${a.file}`;
  const meta = [["Status", `<span class="status ${a.status}">${a.status}</span>`], ["Decided", fmt(a.date)], ["Impact", `<span class="impact ${a.impact}">${a.impact}</span>`],
    ["Domain", esc(dm.get(a.domain)?.name)], ["Products", esc(a.product_names.join(", ")) || "—"], ["Platforms", esc(a.platforms.join(", ")) || "—"],
    ["Decision type", a.decision_type], ["Owner", esc(a.owner)], ["Decided by", esc(a.decided_by)],
    ["GxP / GDP", a.gxp_relevant ? "Relevant" : "Not relevant"], ["Security review", a.security_review],
    ["Supersedes", a.supersedes.map((s) => `<a href="#adr=${s}">${s}</a>`).join(", ") || "—"], ["Superseded by", a.superseded_by ? `<a href="#adr=${a.superseded_by}">${a.superseded_by}</a>` : "—"]];
  $("#drawer-body").innerHTML = `<div class="md"><h1>${esc(a.title)}</h1></div>
    <div class="meta-grid">${meta.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>
    ${a.links.length ? `<p>${a.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(" · ")}</p>` : ""}
    <div class="md">${md(a.body)}</div>
    <div class="history"><div class="k" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600">History</div>
      <ul>${a.history.length ? a.history.map((h) => `<li>${h.date.slice(0, 10)} · <b>${esc(h.subject)}</b> · ${esc(h.author)} · ${h.sha}</li>`).join("") : "<li>Not yet committed</li>"}</ul></div>`;
  $("#drawer").classList.add("is-open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("is-open");
  $("#drawer-close").focus();
}
function closeDrawer() {
  $("#drawer").classList.remove("is-open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").classList.remove("is-open");
  if (location.hash.includes("adr=")) { const h = new URLSearchParams(location.hash.slice(1)); h.delete("adr"); history.replaceState(null, "", "#" + h.toString()); }
}

/* ---------- tiny markdown renderer (headings, tables, lists, bold, code) ---------- */
function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\b(ADR-\d{4})\b/g, '<a href="#adr=$1">$1</a>'); }
function md(src) {
  const lines = src.split("\n"); let out = "", i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^#{1,3}\s/.test(l)) { const lvl = l.match(/^#+/)[0].length; out += `<h${lvl === 1 ? 1 : 2}>${inline(l.replace(/^#+\s/, ""))}</h${lvl === 1 ? 1 : 2}>`; i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
      out += "<table><thead><tr>" + cells(rows[0]).map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" + rows.slice(2).map((r) => "<tr>" + cells(r).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>"; continue; }
    if (/^\s*[-*]\s/.test(l)) { out += "<ul>"; while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) out += `<li>${inline(lines[i++].replace(/^\s*[-*]\s/, ""))}</li>`; out += "</ul>"; continue; }
    if (l.trim() === "") { i++; continue; }
    let p = l; i++; while (i < lines.length && lines[i].trim() && !/^(#|\||\s*[-*]\s)/.test(lines[i])) p += " " + lines[i++];
    out += `<p>${inline(p)}</p>`;
  }
  return out;
}

/* ---------- state, hash, events ---------- */
function writeHash() {
  const h = new URLSearchParams();
  if (state.q) h.set("q", state.q);
  for (const k of ["status", "products", "domains", "platforms", "types", "impact", "flags"]) if (state[k].size) h.set(k, [...state[k]].join(","));
  if (state.sort !== "date:desc") h.set("sort", state.sort);
  if (state.view !== "register") h.set("view", state.view);
  if (state.days !== 7) h.set("days", state.days);
  const cur = new URLSearchParams(location.hash.slice(1)); if (cur.get("adr")) h.set("adr", cur.get("adr"));
  history.replaceState(null, "", "#" + h.toString());
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  state.q = h.get("q") ?? "";
  for (const k of ["status", "products", "domains", "platforms", "types", "impact", "flags"]) state[k] = new Set((h.get(k) ?? "").split(",").filter(Boolean));
  state.sort = h.get("sort") ?? "date:desc"; state.view = h.get("view") ?? "register"; state.days = Number(h.get("days")) || 7;
  $("#q").value = state.q; $("#sort").value = state.sort;
  $$(".seg button").forEach((b) => b.classList.toggle("is-active", Number(b.dataset.days) === state.days));
}
function setView(v) {
  state.view = v;
  $$(".tab").forEach((t) => { const on = t.dataset.view === v; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", on); });
  $$(".view").forEach((s) => s.classList.toggle("is-active", s.dataset.view === v));
}
function render() {
  setView(state.view);
  renderRegister(); renderChanges(); renderCoverage(); renderReports();
  writeHash();
  const adr = new URLSearchParams(location.hash.slice(1)).get("adr"); if (adr) openAdr(adr);
}
function bind() {
  $("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement !== $("#q")) { e.preventDefault(); $("#q").focus(); } if (e.key === "Escape") closeDrawer(); });
  $(".rail").addEventListener("change", (e) => { const { set, value } = e.target.dataset ? { set: e.target.dataset.set, value: e.target.value } : {}; if (!set) return; e.target.checked ? state[set].add(value) : state[set].delete(value); render(); });
  $("#clear").addEventListener("click", () => { for (const k of ["status", "products", "domains", "platforms", "types", "impact", "flags"]) state[k].clear(); state.q = ""; $("#q").value = ""; buildFacets(); render(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $$("#ledger th[data-sort]").forEach((th) => th.addEventListener("click", () => { const [k, d] = state.sort.split(":"); state.sort = th.dataset.sort + ":" + (k === th.dataset.sort && d === "desc" ? "asc" : "desc"); $("#sort").value = state.sort; render(); }));
  $("#ledger tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) location.hash = updateHash("adr", tr.dataset.id); });
  $("#ledger tbody").addEventListener("keydown", (e) => { if (e.key === "Enter") { const tr = e.target.closest("tr"); if (tr) location.hash = updateHash("adr", tr.dataset.id); } });
  $$(".tab").forEach((t) => t.addEventListener("click", () => { setView(t.dataset.view); writeHash(); }));
  $$(".seg button").forEach((b) => b.addEventListener("click", () => { state.days = Number(b.dataset.days); $$(".seg button").forEach((x) => x.classList.toggle("is-active", x === b)); renderChanges(); writeHash(); }));
  $("#estate").addEventListener("click", (e) => { const c = e.target.closest(".cell"); if (!c) return; for (const k of ["products", "domains"]) state[k].clear(); state.products.add(c.dataset.product); buildFacets(); setView("register"); render(); });
  $("#drawer-close").addEventListener("click", closeDrawer); $("#scrim").addEventListener("click", closeDrawer);
  window.addEventListener("hashchange", () => { const adr = new URLSearchParams(location.hash.slice(1)).get("adr"); adr ? openAdr(adr) : closeDrawer(); });
  $("#export").addEventListener("click", exportCsv);
}
function updateHash(k, v) { const h = new URLSearchParams(location.hash.slice(1)); h.set(k, v); return h.toString(); }
function exportCsv() {
  const dm = domainMap();
  const cols = ["id", "title", "status", "date", "updated", "domain", "products", "platforms", "decision_type", "impact", "gxp_relevant", "security_review", "owner", "decided_by", "supersedes", "superseded_by", "tags", "file"];
  const rows = filtered().map((a) => cols.map((c) => { let v = a[c]; if (c === "domain") v = dm.get(v)?.name; if (Array.isArray(v)) v = v.join("; "); return `"${String(v ?? "").replace(/"/g, '""')}"`; }).join(","));
  const blob = new Blob([cols.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
  const u = URL.createObjectURL(blob); const link = Object.assign(document.createElement("a"), { href: u, download: `adr-register-${new Date().toISOString().slice(0, 10)}.csv` }); link.click(); URL.revokeObjectURL(u);
}

load().catch((e) => { $("#main").innerHTML = `<div class="empty"><p>Could not load register data: ${esc(e.message)}. Run <code>npm run build</code> first.</p></div>`; });
