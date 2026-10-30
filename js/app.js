import { CALCS, renderCalc } from "./calculators.js";

const GROUP_ORDER = ["csDMARDs", "Biologics (bDMARDs)", "Targeted synthetic (tsDMARDs)"];
const GROUP_SHORT = {
  "csDMARDs": "csDMARD",
  "Biologics (bDMARDs)": "Biologic",
  "Targeted synthetic (tsDMARDs)": "tsDMARD",
};
const TOPIC_IDS = ["corticosteroids", "surgery", "vaccination", "pregnancy"];
const TOPIC_ICONS = { corticosteroids: "◐", surgery: "✚", vaccination: "◉", pregnancy: "♡" };

// Which calculators are relevant to each guideline page (page id -> calc ids).
export const PAGE_CALCS = {
  methotrexate: ["bloods", "renal", "dosing", "schedule"],
  azathioprine: ["bloods", "dosing", "schedule"],
  leflunomide: ["bloods", "schedule"],
  "mycophenolate-mofetil": ["bloods", "renal", "schedule"],
  sulfasalazine: ["bloods", "schedule"],
  cyclosporine: ["bloods", "dosing", "schedule"],
  cyclophosphamide: ["bloods"],
  hydroxychloroquine: ["dosing"],
  penicillamine: ["schedule"],
  baricitinib: ["bloods", "renal", "periop"],
  filgotinib: ["bloods", "renal", "periop"],
  tofacitinib: ["bloods", "renal", "periop"],
  upadacitinib: ["bloods", "renal", "periop"],
  apremilast: ["renal", "periop"],
  infliximab: ["dosing", "periop"],
  tocilizumab: ["dosing", "periop"],
  corticosteroids: ["steroids"],
  surgery: ["periop", "steroids"],
};
["abatacept", "adalimumab", "certolizumab-pegol", "etanercept", "golimumab", "ixekizumab",
  "rituximab", "sarilumab", "secukinumab", "ustekinumab", "risankizumab", "avacopan"]
  .forEach((id) => { PAGE_CALCS[id] = ["periop"]; });

const state = { guide: null, res: null, pages: new Map() };
const main = document.getElementById("main");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function load() {
  const [guide, res] = await Promise.all([
    fetch("content/guideline.json").then((r) => r.json()),
    fetch("content/resources.json").then((r) => r.json()),
  ]);
  state.guide = guide;
  state.res = res;
  for (const p of guide.pages) state.pages.set(p.id, p);
  for (const g of res.gaps) state.pages.set(g.id, { ...g, kind: "gap", html: "", text: g.why });
}

function drugs() {
  return [...state.pages.values()].filter((p) => p.kind === "drug" || p.kind === "gap");
}

function groupedDrugs() {
  const out = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const p of drugs()) out.get(p.group)?.push(p);
  for (const list of out.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

function sourceLine() {
  const s = state.guide.source;
  return `Source: Yorkshire Rheumatology Regional DMARD Guidelines, ${esc(s.edition)} (${esc(s.revised)}). Review due 2028.`;
}

// ---------- Views ----------

function viewHome() {
  const tiles = [
    { href: "#/drugs?g=csDMARDs", icon: "℞", t: "csDMARDs", s: "Methotrexate, sulfasalazine, HCQ…" },
    { href: "#/drugs?g=Biologics (bDMARDs)", icon: "◈", t: "Biologics", s: "TNF, IL-6, IL-17, IL-23, B-cell…" },
    { href: "#/drugs?g=Targeted synthetic (tsDMARDs)", icon: "◇", t: "JAK & targeted synthetic", s: "Baricitinib, tofacitinib, upadacitinib…" },
    ...TOPIC_IDS.map((id) => ({ href: `#/page/${id}`, icon: TOPIC_ICONS[id], t: state.pages.get(id).title, s: "Guidance" })),
    { href: "#/shared-care", icon: "⇄", t: "Shared care", s: "HNY and West Yorkshire APC documents" },
    { href: "#/links", icon: "↗", t: "National guidance", s: "BSR 2025, biologic safety, MHRA" },
    { href: "#/evidence", icon: "★", t: "Key evidence", s: "Selected studies" },
  ];
  main.innerHTML = `
    <section class="hero">
      <h1>DMARD prescribing & monitoring</h1>
      <p>Regional guidance for adult rheumatology patients on conventional, biologic and targeted synthetic DMARDs.</p>
    </section>
    <div class="grid">
      ${tiles.map((t) => `<a class="card tile" href="${esc(t.href)}"><span class="icon" aria-hidden="true">${t.icon}</span><b>${esc(t.t)}</b><small>${esc(t.s)}</small></a>`).join("")}
      <a class="card tile addon" href="#/calc"><span class="icon" aria-hidden="true">±</span><b>Calculators</b><small>Add-on tools: blood results, renal, dosing, steroids, peri-op</small></a>
    </div>
    <h2>Quick access</h2>
    <div class="chips">
      ${["methotrexate", "hydroxychloroquine", "sulfasalazine", "leflunomide", "azathioprine", "adalimumab", "baricitinib", "upadacitinib"]
        .map((id) => `<a class="chip brand" href="#/page/${id}">${esc(state.pages.get(id)?.title)}</a>`).join("")}
    </div>
    <p class="source">${sourceLine()} National BSR guidance takes precedence where it differs. <a href="#/about">About this app</a></p>`;
}

function viewDrugs(params) {
  const sel = params.get("g") || "all";
  const groups = groupedDrugs();
  const legacy = new Set(state.res.status.legacy);
  const filters = ["all", ...GROUP_ORDER];
  main.innerHTML = `
    <h1>Drugs</h1>
    <div class="chips" role="group" aria-label="Filter by class">
      ${filters.map((g) => `<a class="chip ${g === sel ? "brand" : ""}" href="#/drugs?g=${encodeURIComponent(g)}" ${g === sel ? 'aria-current="true"' : ""}>${esc(g === "all" ? "All" : g)}</a>`).join("")}
    </div>
    ${[...groups].filter(([g]) => sel === "all" || g === sel).map(([g, list]) => `
      <h2>${esc(g)}</h2>
      <p class="muted small">${esc(state.res.status[g] || "")}</p>
      <ul class="list">
        ${list.map((p) => `<li><a href="#/page/${p.id}"><span>${esc(p.title)} ${p.subtitle ? `<small>${esc(p.subtitle)}</small>` : ""}
          ${p.kind === "gap" ? '<span class="chip warn">To be written</span>' : ""}
          ${legacy.has(p.id) ? '<span class="chip">Rarely used</span>' : ""}</span></a></li>`).join("")}
      </ul>`).join("")}`;
}

function viewTopics() {
  main.innerHTML = `
    <h1>Topics</h1>
    <ul class="list">
      ${TOPIC_IDS.map((id) => `<li><a href="#/page/${id}"><span>${TOPIC_ICONS[id]} ${esc(state.pages.get(id).title)}</span></a></li>`).join("")}
      <li><a href="#/page/biologics"><span>Biologics: overview, tables & TNF inhibitor safety</span></a></li>
      <li><a href="#/shared-care"><span>Shared care</span></a></li>
      <li><a href="#/evidence"><span>Key evidence</span></a></li>
      <li><a href="#/page/abbreviations"><span>Abbreviations</span></a></li>
      <li><a href="#/page/introduction"><span>Introduction to the regional guideline</span></a></li>
      <li><a href="#/page/references"><span>References</span></a></li>
      <li><a href="#/about"><span>About this app</span></a></li>
    </ul>`;
}

function emcLink(title) {
  return `https://www.medicines.org.uk/emc/search?q=${encodeURIComponent(title)}`;
}

function viewPage(id) {
  const p = state.pages.get(id);
  if (!p) return viewNotFound();
  const calcs = (PAGE_CALCS[id] || []).map((c) => CALCS.find((x) => x.id === c)).filter(Boolean);
  const isDrug = p.kind === "drug" || p.kind === "gap";
  const status = state.res.status[p.group];
  const legacy = state.res.status.legacy.includes(id);
  const crumb = isDrug
    ? `<a href="#/drugs">Drugs</a> › <a href="#/drugs?g=${encodeURIComponent(p.group)}">${esc(p.group)}</a>`
    : `<a href="#/topics">Topics</a>`;

  let body;
  if (p.kind === "gap") {
    body = `<div class="notice warn"><b>Not yet written.</b> ${esc(p.why)} The editorial group will add content from the SmPC, NICE and BSR guidance.</div>
      <div class="actions"><a class="btn" target="_blank" rel="noopener" href="${emcLink(p.title)}">SmPC (eMC) ↗</a></div>`;
  } else {
    body = `<div class="guideline">${p.html || '<p class="muted">See the individual drug pages.</p>'}</div>`;
  }

  main.innerHTML = `
    <div class="crumbs">${crumb}</div>
    <h1>${esc(p.title)}</h1>
    ${p.subtitle ? `<div class="muted">${esc(p.subtitle)}</div>` : ""}
    <div class="chips">
      ${isDrug ? `<span class="chip brand">${esc(GROUP_SHORT[p.group] || p.group)}</span>` : ""}
      ${legacy ? '<span class="chip">Rarely used: candidate for archive</span>' : ""}
      ${p.group === "Biologics (bDMARDs)" ? '<span class="chip warn">BSR update due 2026</span>' : ""}
      ${p.group === "csDMARDs" && p.kind === "drug" ? '<span class="chip warn">Check against BSR 2025</span>' : ""}
    </div>
    ${isDrug && p.kind === "drug" ? `<div class="actions">
      <a class="btn" href="#/shared-care">Shared care</a>
      <a class="btn" target="_blank" rel="noopener" href="${emcLink(p.title)}">SmPC (eMC) ↗</a>
      <a class="btn" href="#/links">National guidance</a>
    </div>` : ""}
    ${calcs.length ? `<div class="notice info"><b>Calculators:</b> ${calcs.map((c) => `<a href="#/calc/${c.id}?drug=${encodeURIComponent(id)}">${esc(c.title)}</a>`).join(" · ")}</div>` : ""}
    ${status && p.kind === "drug" ? `<p class="small muted">${esc(status)}</p>` : ""}
    ${toc(p)}
    ${body}
    <p class="source">${p.kind === "gap" ? "Placeholder: new content." : sourceLine()}</p>`;
  enhanceTables(main);
}

function toc(p) {
  if (p.kind !== "chapter") return "";
  const heads = [...p.html.matchAll(/<h([23])[^>]*>(.*?)<\/h\1>/gs)].map((m) => m[2].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
  if (p.id === "biologics") {
    const list = groupedDrugs().get("Biologics (bDMARDs)");
    return `<div class="toc">${list.map((d) => `<a class="chip brand" href="#/page/${d.id}">${esc(d.title)}</a>`).join("")}</div>`;
  }
  return heads.length > 1 ? `<div class="toc">${heads.map((h) => `<span class="chip">${esc(h)}</span>`).join("")}</div>` : "";
}

/** Style two-column monograph tables and highlight stop/monitoring rows. */
function enhanceTables(root) {
  root.querySelectorAll(".guideline table").forEach((t) => {
    const rows = [...t.rows];
    const max = Math.max(...rows.map((r) => r.cells.length));
    if (rows.length && max === 2) {
      t.classList.add("kv");
      rows.forEach((r) => {
        if (r.cells.length < 2) return;
        const label = r.cells[0].textContent.toLowerCase();
        if (/stop|indications? for/.test(label)) r.classList.add("row-stop");
        else if (/monitoring|baseline/.test(label)) r.classList.add("row-monitor");
      });
    }
  });
}

function viewLinks() {
  const n = state.res.national;
  main.innerHTML = `
    <h1>National guidance</h1>
    <p class="muted">National guidance takes precedence over the regional guideline where they differ.</p>
    <ul class="list">
      ${n.map((x) => `<li><a target="_blank" rel="noopener" href="${esc(x.url)}"><span><b>${esc(x.title)}</b><br>
        <small>${esc(x.org)} · ${esc(x.year)}</small>
        ${x.status === "update-due" ? '<span class="chip warn">Update expected 2026</span>' : ""}
        <br><small>${esc(x.note)}</small></span></a></li>`).join("")}
    </ul>`;
}

function viewSharedCare() {
  const sc = state.res.sharedCare;
  main.innerHTML = `
    <h1>Shared care</h1>
    <p class="muted">Shared care protocols are owned by each Area Prescribing Committee. The app links to the live version so you always see the current document.</p>
    ${sc.map((r) => `
      <section class="card" style="margin-bottom:12px">
        <h2 style="margin-top:0">${esc(r.region)}</h2>
        <p>${esc(r.how)}</p>
        <div class="actions"><a class="btn primary" target="_blank" rel="noopener" href="${esc(r.url)}">${esc(r.body)} ↗</a></div>
        ${r.known.length ? `<p class="small"><b>Known DMARD protocols:</b></p><ul class="small">${r.known.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
        ${r.todo ? `<div class="notice warn small">${esc(r.todo)}</div>` : ""}
      </section>`).join("")}`;
}

function viewEvidence() {
  const ev = state.res.evidence;
  main.innerHTML = `
    <h1>Key evidence</h1>
    <div class="notice info">${esc(ev.statement)}</div>
    <ul class="list">
      ${ev.items.map((e) => e.url
        ? `<li><a target="_blank" rel="noopener" href="${esc(e.url)}"><span><b>${esc(e.title)}</b><br><small>${esc(e.why)}</small></span></a></li>`
        : `<li><a aria-disabled="true"><span class="muted">${esc(e.title)}</span></a></li>`).join("")}
    </ul>`;
}

function viewAbout() {
  const s = state.guide.source;
  main.innerHTML = `
    <h1>About this app</h1>
    <div class="notice warn"><b>Prototype.</b> This app has not been clinically approved, does not have a clinical safety case (DCB0129/DCB0160), and the calculators are not a registered medical device. Do not use for patient care.</div>
    <h2>Content</h2>
    <p>Guideline pages are generated from <i>${esc(s.title.toLowerCase())}</i>, ${esc(s.edition)}, ${esc(s.revised)}. They were written by the Yorkshire regional rheumatology group; suggestions to Dr Gui Tran, Harrogate District Hospital.</p>
    <p>National BSR guidance takes precedence where it differs from the regional guideline. See <a href="#/links">National guidance</a>.</p>
    <h2>Funding and editorial independence</h2>
    <p>[Sponsor statement: pending a written agreement under the ABPI Code of Practice.] The funder has no editorial input into content, drug pages, calculators or the selection of evidence.</p>
    <h2>Privacy</h2>
    <p>The app does not collect, store or transmit patient data. Calculator inputs stay on this device and are cleared when you leave the page.</p>
    <h2>Offline use</h2>
    <p>After your first visit the app works offline. On a phone, use “Add to Home Screen” to install it.</p>`;
}

function viewCalcIndex() {
  main.innerHTML = `
    <h1>Calculators</h1>
    <div class="notice warn"><b>Add-on tools.</b> These apply the thresholds in the regional guideline to the numbers you enter. They support, but don't replace, the guideline text, the SmPC and clinical judgement. Prototype: not validated.</div>
    <div class="grid">
      ${CALCS.map((c) => `<a class="card tile" href="#/calc/${c.id}"><span class="icon" aria-hidden="true">${c.icon}</span><b>${esc(c.title)}</b><small>${esc(c.desc)}</small></a>`).join("")}
    </div>`;
}

function viewSearch(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return viewHome();
  const items = [
    ...[...state.pages.values()].map((p) => ({ title: p.title, sub: p.subtitle || p.group || "", text: p.text || "", href: `#/page/${p.id}` })),
    ...CALCS.map((c) => ({ title: c.title, sub: "Calculator", text: c.desc, href: `#/calc/${c.id}` })),
    ...state.res.national.map((n) => ({ title: n.title, sub: n.org, text: n.note, href: "#/links" })),
  ];
  const scored = items.map((it) => {
    const t = it.title.toLowerCase();
    const body = it.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (t.startsWith(term)) score += 20;
      else if (t.includes(term)) score += 10;
      if ((it.sub || "").toLowerCase().includes(term)) score += 4;
      const hits = body.split(term).length - 1;
      if (!hits && !t.includes(term)) return null;
      score += Math.min(hits, 5);
    }
    return { ...it, score, snippet: snippet(it.text, terms[0]) };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30);
  main.innerHTML = `
    <h1>Search: “${esc(q)}”</h1>
    ${scored.length ? `<ul class="list">${scored.map((r) => `<li><a class="result" href="${r.href}"><b>${esc(r.title)}</b> <small>${esc(r.sub)}</small><small>${r.snippet}</small></a></li>`).join("")}</ul>`
      : '<p class="muted">No matches. Try a drug name, a blood test (e.g. “neutrophils”) or a topic (e.g. “shingles”).</p>'}`;
}

function snippet(text, term) {
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return esc(text.slice(0, 140));
  const start = Math.max(0, i - 60);
  const s = text.slice(start, i + 100);
  const j = i - start;
  return (start ? "…" : "") + esc(s.slice(0, j)) + "<mark>" + esc(s.slice(j, j + term.length)) + "</mark>" + esc(s.slice(j + term.length)) + "…";
}

function viewNotFound() {
  main.innerHTML = `<h1>Not found</h1><p><a href="#/">Back to home</a></p>`;
}

// ---------- Router ----------

function route() {
  const hash = decodeURIComponent(location.hash.slice(1) || "/");
  const [path, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  const section = parts[0] || "home";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const nav = a.dataset.nav;
    const active = nav === section || (nav === "drugs" && section === "page" && state.pages.get(parts[1])?.kind !== "chapter")
      || (nav === "topics" && section === "page" && state.pages.get(parts[1])?.kind === "chapter")
      || (nav === "links" && section === "shared-care");
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  switch (section) {
    case "home": viewHome(); break;
    case "drugs": viewDrugs(params); break;
    case "topics": viewTopics(); break;
    case "page": viewPage(parts[1]); break;
    case "links": viewLinks(); break;
    case "shared-care": viewSharedCare(); break;
    case "evidence": viewEvidence(); break;
    case "about": viewAbout(); break;
    case "search": viewSearch(params.get("q") || ""); break;
    case "calc":
      if (parts[1]) {
        const c = CALCS.find((x) => x.id === parts[1]);
        if (c) renderCalc(main, c, params, state); else viewNotFound();
      } else viewCalcIndex();
      break;
    default: viewNotFound();
  }
  const title = main.querySelector("h1")?.textContent;
  document.title = title && section !== "home" ? `${title} · DMARD Guide` : "DMARD Guide (Yorkshire)";
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("q").value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : "#/";
});
let searchTimer;
document.getElementById("q").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  searchTimer = setTimeout(() => {
    if (q.length >= 2) history.replaceState(null, "", `#/search?q=${encodeURIComponent(q)}`), viewSearch(q);
  }, 200);
});

window.addEventListener("hashchange", route);
load().then(route).catch((err) => {
  main.innerHTML = `<div class="notice stop">Could not load content: ${esc(err.message)}</div>`;
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
