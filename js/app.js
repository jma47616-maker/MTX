import { CALCS, renderCalc } from "./calculators.js";
import { BLOOD_RULESETS, PERIOP, RENAL_RULES } from "./calc-core.js";

// ---------- Constants ----------

const GROUPS = {
  "csDMARDs": { slug: "csdmards", short: "csDMARD", name: "Conventional synthetic", dot: "cs", icon: "pill", tone: "blue" },
  "Biologics (bDMARDs)": { slug: "biologics", short: "Biologic", name: "Biologic", dot: "bio", icon: "flask", tone: "red" },
  "Targeted synthetic (tsDMARDs)": { slug: "tsdmards", short: "tsDMARD", name: "Targeted synthetic", dot: "ts", icon: "target", tone: "grey" },
};
const GROUP_ORDER = Object.keys(GROUPS);
const SLUG_GROUP = Object.fromEntries(GROUP_ORDER.map((g) => [GROUPS[g].slug, g]));
const TOPIC_IDS = ["corticosteroids", "surgery", "vaccination", "pregnancy"];
const TOPIC_META = {
  corticosteroids: { icon: "layers", tone: "grey", blurb: "Bone protection, adrenal suppression, steroid cards, live vaccines, tapering" },
  surgery: { icon: "building", tone: "blue", blurb: "When to stop and restart each biologic and JAK inhibitor; csDMARDs usually continue" },
  vaccination: { icon: "shield", tone: "blue", blurb: "Live vaccine rules, shingles, pneumococcal, influenza, COVID-19, travel" },
  pregnancy: { icon: "heart", tone: "red", blurb: "BSR 2023 compatibility: peri-conception, each trimester, breastfeeding, paternal exposure" },
};
const JAKS = new Set(["baricitinib", "filgotinib", "tofacitinib", "upadacitinib"]);

// Which calculators each page offers (page id -> calc ids).
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

// BNF section order. Each regional field lands in the first section whose
// pattern matches its key.
const SECTIONS = [
  { id: "indications", title: "Indications and dose", match: /^(dose|licensed-dose|licensed-indication|therapeutic-class|preparation|licensed-preparation|infusion)/ },
  { id: "nice", title: "NICE and commissioning", match: /^nice/ },
  { id: "cautions", title: "Contra-indications, cautions and interactions", match: /^(warnings|additional-information|elderly|contra)/ },
  { id: "screening", title: "Pre-treatment screening", match: /^baseline/ },
  { id: "monitoring", title: "Monitoring requirements", match: /^routine-monitoring|^monitoring/ },
  { id: "stop", title: "Side-effects and stop criteria", match: /^indications-for-stopping|^stop/, danger: true },
  { id: "renal", title: "Renal and hepatic impairment", match: /^(renal|hepatic)/ },
  { id: "pregnancy", title: "Pregnancy and breast feeding", match: /^pregnancy/ },
  { id: "response", title: "Assessment of response", match: /^assessment/ },
];

const ICONS = {
  pill: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"></rect><path d="M9.5 7.5l5 9" transform="rotate(-35 12 12)"></path></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M12 3v4M8 7h8l-1 11a3 3 0 0 1-3 3 3 3 0 0 1-3-3z"></path><path d="M9 13h6"></path></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M9 12h6M12 9v6"></path></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="M4 12h16M4 7h16M4 17h10"></path></svg>',
  building: '<svg viewBox="0 0 24 24"><path d="M4 20h16M6 20V9l6-5 6 5v11"></path></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z"></path></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"></path></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"></path></svg>',
  kidney: '<svg viewBox="0 0 24 24"><path d="M6 3h12l-4 8v7l-4 2v-9z"></path></svg>',
  scale: '<svg viewBox="0 0 24 24"><path d="M12 3v18M5 8l7-5 7 5M4 14h4l-2-4zM16 14h4l-2-4z"></path></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M4 10h16"></path></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14H6a2 2 0 0 0-2 2z"></path><path d="M4 19V5M8 7h8"></path></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>',
  check: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.18)"></circle><path d="M20 34l8 8 16-18" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
};
const CALC_ICON = { bloods: ["drop", "red"], renal: ["kidney", "blue"], dosing: ["scale", "blue"], steroids: ["layers", "grey"], periop: ["building", "grey"], schedule: ["calendar", "blue"] };

const state = { guide: null, res: null, nat: {}, preg: { drugs: {} }, pages: new Map(), q: "", filter: "all", recent: [] };
const main = document.getElementById("main");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (name, tone) => `<span class="ic ${tone}">${ICONS[name]}</span>`;
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const isDesktop = () => window.matchMedia("(min-width: 900px)").matches;

// ---------- Data ----------

async function load() {
  const inline = window.__DMARD_DATA__;
  const get = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [guide, res, nat, preg] = inline
    ? [inline.guideline, inline.resources, inline.national, inline.pregnancy]
    : await Promise.all([get("content/guideline.json"), get("content/resources.json"), get("content/national.json"), get("content/national-pregnancy.json")]);
  state.guide = guide; state.res = res; state.nat = nat || {}; state.preg = preg || { drugs: {} };
  for (const p of guide.pages) state.pages.set(p.id, p);
  for (const g of res.gaps) state.pages.set(g.id, { ...g, kind: "gap", html: "", text: g.why, fields: {} });
  try { state.recent = JSON.parse(localStorage.getItem("dmard.recent") || "[]"); } catch { state.recent = []; }
}

function remember(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 6);
  try { localStorage.setItem("dmard.recent", JSON.stringify(state.recent)); } catch { /* storage unavailable */ }
}

const drugs = () => [...state.pages.values()].filter((p) => p.kind === "drug" || p.kind === "gap");
const byGroup = (g) => drugs().filter((p) => p.group === g).sort((a, b) => a.title.localeCompare(b.title));
const dotFor = (p) => (p.kind === "gap" ? "gap" : GROUPS[p.group]?.dot || "cs");
const pillFor = (p) => ({ cs: "blue", bio: "red", ts: "grey", gap: "grey" }[dotFor(p)]);
const sourceLine = () => `Yorkshire Rheumatology Regional DMARD Guidelines, ${esc(state.guide.source.edition)} (${esc(state.guide.source.revised)}). Review due 2028.`;
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const emcLink = (title) => `https://www.medicines.org.uk/emc/search?q=${encodeURIComponent(title)}`;

// ---------- Home ----------

function viewHome() {
  const cats = [
    ...GROUP_ORDER.map((g) => ({ href: `#drugs--${GROUPS[g].slug}`, icon: GROUPS[g].icon, tone: GROUPS[g].tone, t: g === "csDMARDs" ? "csDMARDs" : g === "Biologics (bDMARDs)" ? "Biologics" : "JAK / tsDMARD" })),
    ...TOPIC_IDS.map((id) => ({ href: `#page--${id}`, icon: TOPIC_META[id].icon, tone: TOPIC_META[id].tone, t: state.pages.get(id).title.split(" ")[0] })),
  ];
  const popular = (state.recent.length ? state.recent : ["methotrexate", "adalimumab", "baricitinib", "hydroxychloroquine"])
    .map((id) => state.pages.get(id)).filter(Boolean).slice(0, 4);
  const bsr = state.nat.bsr2025;
  main.innerHTML = `
    <div class="home-grid">
      <div class="stack-lg">
        <div class="stack">
          <div class="home-head">
            <div class="avatar" aria-hidden="true">Rx</div>
            <div><div class="small muted">${greeting()}</div><strong>DMARD Guide · Yorkshire</strong></div>
          </div>
          <a class="searchbar" href="#search">${ICONS.search}<span>Search drugs, tests, topics</span></a>
        </div>

        <section class="grad hero stack" style="gap:10px">
          <span class="lab">Yorkshire regional guidance · ${esc(state.guide.source.edition)}, ${esc(state.guide.source.revised.replace("Revised ", ""))}</span>
          <h1>Prescribing and monitoring DMARDs</h1>
          <p class="sub">Conventional, biologic and targeted synthetic DMARDs for adults, with national BSR guidance and local shared care protocols one tap away.</p>
          <div class="row" style="margin-top:6px">
            <a class="btn" style="background:#fff;color:var(--blue-deep);border-color:#fff" href="#drugs">Browse drugs</a>
            <a class="btn primary" href="#calc--bloods">Check a blood result</a>
          </div>
        </section>

        <section class="stack" style="gap:10px">
          <div class="between"><h2>Browse</h2><a class="small" href="#drugs"><b>All drugs</b></a></div>
          <div class="hscroll">${cats.map((c) => `<a class="cat" href="${c.href}">${icon(c.icon, c.tone)}<span>${esc(c.t)}</span></a>`).join("")}</div>
        </section>

        ${bsr ? `<section class="grad feature">
          <div class="body">
            <span class="lab">National guidance</span>
            <h2>${esc(bsr.short)}: csDMARD prescribing and monitoring</h2>
            <p class="sub">Takes precedence over the regional guideline. Risk-adapted monitoring, FIB-4 before methotrexate, no routine bloods for hydroxychloroquine.</p>
            <a class="btn ghost sm" href="#national" style="align-self:flex-start;margin-top:4px">What changed</a>
          </div>${ICONS.check}</section>` : ""}

        <section class="stack" style="gap:10px">
          <div class="between"><h2>Tools</h2><a class="small" href="#calc"><b>See all</b></a></div>
          <div class="hscroll">${CALCS.slice(0, 3).map((c) => `<a class="tile" style="min-width:168px" href="#calc--${c.id}">${icon(...CALC_ICON[c.id])}<strong>${esc(c.title)}</strong><small>${esc(c.desc)}</small></a>`).join("")}</div>
        </section>

        <section class="stack" style="gap:10px">
          <div class="between"><h2>${state.recent.length ? "Recent" : "Popular drugs"}</h2><a class="small" href="#drugs"><b>See all</b></a></div>
          <div class="hscroll">${popular.map((p) => `<a class="drugcard" href="#page--${p.id}">
            <span class="between"><span class="pill ${pillFor(p)}">${esc(GROUPS[p.group]?.short || "")}</span></span>
            <span class="art"><span class="dot ${dotFor(p)}" style="width:28px;height:12px;border-radius:999px"></span></span>
            <span><strong>${esc(p.title)}</strong><br><small>${esc(doseHint(p))}</small></span></a>`).join("")}</div>
        </section>
      </div>

      <aside class="stack-lg">
        <section class="card stack" style="gap:10px">
          <span class="lab">What's new</span>
          <a href="#national" class="stack" style="gap:2px;color:var(--ink)"><strong>BSR 2025 csDMARD guideline</strong><small class="muted">Supersedes regional csDMARD monitoring where they differ.</small></a>
          <a href="#page--upadacitinib" class="stack" style="gap:2px;color:var(--ink);border-top:1px solid var(--line);padding-top:10px"><strong>Filgotinib and upadacitinib pages</strong><small class="muted">With MHRA JAK inhibitor risk advice.</small></a>
          <a href="#links" class="stack" style="gap:2px;color:var(--ink);border-top:1px solid var(--line);padding-top:10px"><strong>BSR biologic safety update due 2026/27</strong><small class="muted">Will add JAK, IL-17 and IL-23 inhibitors and children.</small></a>
        </section>
        <section class="stack" style="gap:10px">
          <h2>Topics</h2>
          <ul class="list">${TOPIC_IDS.map((id) => `<li><a href="#page--${id}">${icon(TOPIC_META[id].icon, TOPIC_META[id].tone)}<span class="grow"><strong>${esc(state.pages.get(id).title)}</strong><small>${esc(TOPIC_META[id].blurb)}</small></span><span class="chev">›</span></a></li>`).join("")}</ul>
        </section>
        <p class="small muted">${sourceLine()} Sponsorship statement pending (ABPI Code); the funder has no editorial input. <a href="#about">About this app</a></p>
      </aside>
    </div>`;
}

function doseHint(p) {
  const f = p.fields || {};
  const t = textOf((f.dose || f["licensed-dose"] || {}).html || "");
  if (!t) return p.kind === "gap" ? "Page to be written" : GROUPS[p.group]?.name || "";
  const m = t.match(/\d[\d.,–-]*\s?(mg|g|micrograms)[^.;]{0,30}/i);
  return m ? m[0].trim() : t.slice(0, 40);
}

// ---------- Drug list ----------

function viewDrugs(params) {
  const sel = SLUG_GROUP[params.get("g")] || "all";
  const list = (sel === "all" ? drugs() : byGroup(sel)).sort((a, b) => a.title.localeCompare(b.title));
  const legacy = new Set(state.res.status.legacy);
  let letter = "";
  const items = list.map((p) => {
    const L = p.title[0].toUpperCase();
    const head = sel === "all" && L !== letter ? `<li class="letter">${L}</li>` : "";
    letter = L;
    const sub = p.kind === "gap" ? `${GROUPS[p.group]?.short} · page to be written` : [GROUPS[p.group]?.short, p.subtitle].filter(Boolean).join(" · ");
    const tag = p.kind === "gap" ? '<span class="pill grey">Soon</span>' : legacy.has(p.id) ? '<span class="pill grey">Rarely used</span>' : '<span class="chev">›</span>';
    return head + `<li><a href="#page--${p.id}"><span class="dot ${dotFor(p)}"></span><span class="grow"><strong>${esc(p.title)}</strong><small>${esc(sub)}</small></span>${tag}</a></li>`;
  }).join("");
  main.innerHTML = `
    <div class="stack-lg">
      <div class="stack" style="gap:12px">
        <div class="between"><h1>Drugs</h1><span class="small muted">${list.length} monographs</span></div>
        <nav class="seg" aria-label="Filter by class">
          <a class="${sel === "all" ? "on" : ""}" href="#drugs">All</a>
          ${GROUP_ORDER.map((g) => `<a class="${sel === g ? "on" : ""}" href="#drugs--${GROUPS[g].slug}">${esc(GROUPS[g].short)}</a>`).join("")}
        </nav>
        ${sel !== "all" ? `<div class="notice amber small">${esc(state.res.status[sel] || "")}</div>` : ""}
      </div>
      <ul class="list">${items}</ul>
    </div>`;
}

// ---------- Topics ----------

function viewTopics() {
  const extra = [
    { href: "#page--biologics", title: "Biologics overview", blurb: "Licensed TNF and non-TNF agents, biosimilars, NICE criteria, TNF inhibitor safety", icon: "flask", tone: "red" },
    { href: "#national", title: "National guidance: key points", blurb: "BSR 2025 csDMARD, BSR 2019 biologics, MHRA JAK advice", icon: "book", tone: "blue" },
    { href: "#page--introduction", title: "About the regional guideline", blurb: "Introduction, authors and review date", icon: "book", tone: "grey" },
    { href: "#page--abbreviations", title: "Abbreviations", blurb: "", icon: "layers", tone: "grey" },
    { href: "#page--references", title: "References", blurb: "", icon: "layers", tone: "grey" },
  ];
  main.innerHTML = `
    <div class="stack-lg">
      <div><h1>Topics</h1><p class="muted">Guidance that cuts across drugs</p></div>
      <div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
        ${TOPIC_IDS.map((id) => `<a class="tile" href="#page--${id}">${icon(TOPIC_META[id].icon, TOPIC_META[id].tone)}<strong>${esc(state.pages.get(id).title)}</strong><small>${esc(TOPIC_META[id].blurb)}</small></a>`).join("")}
        ${extra.map((e) => `<a class="tile" href="${e.href}">${icon(e.icon, e.tone)}<strong>${esc(e.title)}</strong><small>${esc(e.blurb)}</small></a>`).join("")}
      </div>
    </div>`;
}

// ---------- Monograph ----------

/** Place regional fields into BNF-ordered sections. */
function sectionsFor(p) {
  const out = SECTIONS.map((s) => ({ ...s, items: [] }));
  const other = { id: "other", title: "Other information", items: [] };
  for (const [key, f] of Object.entries(p.fields || {})) (out.find((x) => x.match.test(key)) || other).items.push(f);
  const list = out.filter((s) => s.items.length);
  if (other.items.length) list.push(other);
  return list;
}

function nationalFor(p) {
  const notes = [];
  const nat = state.nat;
  const add = (src, items) => (items || []).forEach((i) => notes.push({ src, ...i }));
  if (p.group === "csDMARDs" && nat.bsr2025) add(nat.bsr2025, nat.bsr2025.drugs?.[p.id]);
  if (p.group === "Biologics (bDMARDs)" && nat.bsr2019) add(nat.bsr2019, nat.bsr2019.general?.slice(0, 5));
  if (JAKS.has(p.id) && nat.mhra2023) add(nat.mhra2023, nat.mhra2023.general);
  if ((p.id === "methotrexate" || p.id === "azathioprine") && nat.greenBook) add(nat.greenBook, nat.greenBook.general);
  return notes;
}

function pregnancyRow(id) {
  const d = state.preg?.drugs?.[id];
  if (!d) return "";
  const cell = (v) => (v == null ? '<span class="muted">No statement</span>' : esc(v));
  return `<div class="table-wrap" style="margin-top:6px"><table class="data" style="min-width:0"><tbody>
    <tr><th style="width:38%">Peri-conception</th><td>${cell(d.preconception)}</td></tr>
    <tr><th>First trimester</th><td>${cell(d.trimester1)}</td></tr>
    <tr><th>Second and third trimester</th><td>${cell(d.trimester23)}</td></tr>
    <tr><th>Breastfeeding</th><td>${cell(d.breastfeeding)}</td></tr>
    <tr><th>Paternal exposure</th><td>${cell(d.paternal)}</td></tr>
  </tbody></table></div>
  ${d.note ? `<p class="small muted">${esc(d.note)}</p>` : ""}
  <p class="small"><span class="pill blue">BSR 2023</span> <a target="_blank" rel="noopener" href="https://doi.org/${esc(state.preg.source?.doi || "10.1093/rheumatology/keac551")}">Prescribing in pregnancy and breastfeeding</a> · <a href="#page--pregnancy">full table</a></p>`;
}

function hintFor(sec) {
  const t = textOf(sec.items.map((i) => i.html).join(" "));
  if (sec.id === "stop") { const n = (t.match(/[<>]\s?\d/g) || []).length; return n ? `${n} thresholds` : ""; }
  if (sec.id === "monitoring") { const m = t.match(/every \d+ weeks?/i); return m ? m[0] : ""; }
  if (sec.id === "nice") { const m = t.match(/TA\d+/g); return m ? [...new Set(m)].slice(0, 3).join(", ") : ""; }
  return t.length > 48 ? t.slice(0, 44).replace(/\s\S*$/, "") + "…" : t;
}

function viewPage(id) {
  const p = state.pages.get(id);
  if (!p) return viewNotFound();
  if (p.kind === "chapter") return viewChapter(p);
  remember(id);
  const G = GROUPS[p.group] || {};
  const calcs = (PAGE_CALCS[id] || []).map((c) => CALCS.find((x) => x.id === c)).filter(Boolean);
  const primary = BLOOD_RULESETS[id] ? ["bloods", "Check a result"]
    : (PERIOP[id] || p.group !== "csDMARDs") && p.kind === "drug" ? ["periop", "Surgery planner"]
    : RENAL_RULES[id] ? ["renal", "Renal dosing"] : null;
  const legacy = state.res.status.legacy.includes(id);
  const sections = sectionsFor(p);
  const national = nationalFor(p);
  const hasPreg = Boolean(state.preg?.drugs?.[id]);
  const desktop = isDesktop();

  const secHtml = (s, i) => `<details class="sec ${s.danger ? "danger" : ""}" id="s-${s.id}" ${desktop || i === 0 || s.danger ? "open" : ""}>
    <summary><span>${esc(s.title)}</span><span class="row" style="gap:8px;flex-wrap:nowrap"><span class="hint">${esc(hintFor(s))}</span>${ICONS.chevron}</span></summary>
    <div class="body">
      ${s.items.map((f) => `<div class="k">${s.items.length > 1 ? `<span class="lab">${esc(f.label)}</span>` : ""}${f.html}</div>`).join("")}
      ${s.id === "pregnancy" ? pregnancyRow(id) : ""}
      ${s.id === "stop" && BLOOD_RULESETS[id] ? `<a class="btn sm" style="background:var(--red-tint);color:var(--red-deep);border-color:transparent;margin-top:8px" href="#calc--bloods--${id}">Check a result against these criteria</a>` : ""}
      ${s.id === "monitoring" && (PAGE_CALCS[id] || []).includes("schedule") ? `<p class="small"><a href="#calc--schedule--${id}"><b>Generate blood test dates</b></a></p>` : ""}
      ${s.id === "renal" && RENAL_RULES[id] ? `<p class="small"><a href="#calc--renal--${id}"><b>Calculate creatinine clearance</b></a></p>` : ""}
    </div></details>`;

  const showPregInNational = hasPreg && !sections.some((s) => s.id === "pregnancy");
  const natHtml = national.length || showPregInNational ? `<details class="sec" id="s-national" open>
      <summary><span>National guidance</span><span class="row" style="gap:8px;flex-wrap:nowrap"><span class="hint">${national.length} points</span>${ICONS.chevron}</span></summary>
      <div class="body">
        ${national.map((n) => `<div class="src"><span class="pill ${n.src.short?.startsWith("MHRA") ? "red" : "blue"}">${esc(n.src.short)}</span><span>${esc(n.text)}${n.verified === false ? ' <span class="pill amber" title="From secondary reporting; check against the full guideline">Verify</span>' : ""}</span></div>`).join("")}
        ${showPregInNational ? `<div class="k" style="margin-top:8px"><span class="lab">Pregnancy and breast feeding</span>${pregnancyRow(id)}</div>` : ""}
        <p class="small muted" style="margin-top:8px">National guidance takes precedence over the regional text where they differ. Items marked <span class="pill amber">Verify</span> come from secondary summaries and must be checked against the full guideline by the editorial group.</p>
      </div></details>` : "";

  const infoHtml = `<details class="sec" id="s-info" open>
      <summary><span>Prescribing information</span><span class="row" style="gap:8px">${ICONS.chevron}</span></summary>
      <div class="body"><div class="tiles" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
        <a class="tile" target="_blank" rel="noopener" href="${emcLink(p.title)}"><strong>SmPC</strong><small>Full licensed information (eMC)</small></a>
        <a class="tile" href="#links"><strong>Shared care protocol</strong><small>HNY and West Yorkshire APC documents</small></a>
        ${p.group === "csDMARDs" ? '<a class="tile" href="#national"><strong>BSR 2025 guideline</strong><small>National csDMARD guidance</small></a>' : '<a class="tile" href="#national"><strong>BSR biologic safety</strong><small>National guidance, update due 2026/27</small></a>'}
      </div><p class="small muted" style="margin-top:12px">${p.kind === "gap" ? "Placeholder page." : "Source: " + sourceLine()}</p></div></details>`;

  const allSecs = [...sections.map((s) => ({ id: s.id, title: s.title, danger: s.danger })), ...(natHtml ? [{ id: "national", title: "National guidance" }] : []), { id: "info", title: "Prescribing information" }];

  main.innerHTML = `
    <header class="mono-head">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#drugs">Drugs</a> / <a href="#drugs--${G.slug}">${esc(G.name || "")} DMARDs</a></nav>
      <div class="stack" style="gap:8px">
        <h1>${esc(p.title)}</h1>
        <div class="row" style="gap:6px">
          ${p.subtitle ? `<span class="pill white">${esc(p.subtitle)}</span>` : ""}
          <span class="pill white">${esc(G.short || "")}</span>
          ${p.group === "csDMARDs" && p.kind === "drug" ? '<span class="pill" style="background:var(--red);color:#fff">Check vs BSR 2025</span>' : ""}
          ${p.group === "Biologics (bDMARDs)" ? '<span class="pill white">BSR update due 2026/27</span>' : ""}
          ${JAKS.has(id) ? '<span class="pill" style="background:var(--red);color:#fff">MHRA JAK advice</span>' : ""}
          ${legacy ? '<span class="pill white">Rarely used</span>' : ""}
        </div>
      </div>
      <div class="row">
        ${primary ? `<a class="btn primary" href="#calc--${primary[0]}--${id}">${primary[1]}</a>` : ""}
        <a class="btn ghost" target="_blank" rel="noopener" href="${emcLink(p.title)}">SmPC</a>
        ${calcs.length > 1 ? `<a class="btn ghost" href="#calc">Tools (${calcs.length})</a>` : ""}
      </div>
    </header>
    <div class="mono-wrap">
      <nav class="mono-aside" aria-label="On this page">
        <span class="lab" style="padding:0 12px 8px">On this page</span>
        ${allSecs.map((s) => `<a class="${s.danger ? "danger" : ""}" href="#s-${s.id}" data-scroll>${esc(s.title)}</a>`).join("")}
        ${calcs.length ? `<span class="lab" style="padding:16px 12px 8px">Tools</span>${calcs.map((c) => `<a href="#calc--${c.id}--${id}">${esc(c.title)}</a>`).join("")}` : ""}
      </nav>
      <article class="mono-sheet">
        ${p.kind === "gap" ? `<div class="sec"><div class="body" style="padding-top:16px"><div class="notice amber"><span><b>Not yet written.</b> ${esc(p.why)} The editorial group will add content from the SmPC, NICE and BSR guidance.</span></div></div></div>` : ""}
        ${sections.map(secHtml).join("")}
        ${natHtml}
        ${infoHtml}
      </article>
    </div>`;
  main.querySelectorAll("[data-scroll]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }));
}

function viewChapter(p) {
  const calcs = (PAGE_CALCS[p.id] || []).map((c) => CALCS.find((x) => x.id === c)).filter(Boolean);
  const toc = p.id === "biologics" ? `<div class="toc">${byGroup("Biologics (bDMARDs)").map((d) => `<a class="chip" href="#page--${d.id}">${esc(d.title)}</a>`).join("")}</div>` : "";
  const natPreg = p.id === "pregnancy" && state.preg?.general?.length
    ? `<section class="card stack" style="gap:8px"><span class="lab">BSR 2023: generic recommendations</span><ul style="margin:0;padding-left:1.2rem">${state.preg.general.map((g) => `<li>${esc(g)}</li>`).join("")}</ul><p class="small"><a target="_blank" rel="noopener" href="https://doi.org/${esc(state.preg.source?.doi || "")}">Full guideline ↗</a></p></section>` : "";
  main.innerHTML = `
    <div class="stack-lg">
      <div class="stack" style="gap:8px">
        <nav class="small muted" aria-label="Breadcrumb"><a href="#topics" style="color:var(--muted)">Topics</a></nav>
        <h1>${esc(p.title)}</h1>
        ${TOPIC_META[p.id] ? `<p class="muted">${esc(TOPIC_META[p.id].blurb)}</p>` : ""}
        ${calcs.length ? `<div class="row">${calcs.map((c) => `<a class="btn sm" href="#calc--${c.id}">${esc(c.title)}</a>`).join("")}</div>` : ""}
        ${toc}
      </div>
      ${natPreg}
      <article class="chapter">${p.html || '<p class="muted">See the individual drug pages.</p>'}</article>
      <p class="small muted">Source: ${sourceLine()}</p>
    </div>`;
  main.querySelectorAll(".chapter table").forEach((t) => {
    const rows = [...t.rows];
    if (rows.length && Math.max(...rows.map((r) => r.cells.length)) === 2) t.classList.add("kv");
  });
}

// ---------- National guidance ----------

function viewNational() {
  const nat = state.nat;
  const block = (key) => {
    const n = nat[key]; if (!n) return "";
    const tone = key === "mhra2023" ? "red" : "blue";
    return `<section class="card stack" style="gap:10px">
      <div class="between"><h2>${esc(n.title)}</h2><span class="pill ${tone}">${esc(n.short)}</span></div>
      <p class="small muted">${esc(n.status || "")}</p>
      <div>${(n.general || []).map((g) => `<div class="src"><span class="dot ${tone === "red" ? "bio" : "cs"}" style="margin-top:7px"></span><span>${esc(g.text)}${g.verified === false ? ' <span class="pill amber">Verify</span>' : ""}</span></div>`).join("")}</div>
      ${Object.keys(n.drugs || {}).length ? `<div><span class="lab">Drug-specific points</span>${Object.entries(n.drugs).map(([d, items]) => `<div class="src"><a href="#page--${d}" style="min-width:110px"><b>${esc(state.pages.get(d)?.title || d)}</b></a><span>${items.map((i) => esc(i.text) + (i.verified === false ? ' <span class="pill amber">Verify</span>' : "")).join("<br>")}</span></div>`).join("")}</div>` : ""}
      <p class="small"><a target="_blank" rel="noopener" href="${esc(n.url)}">Open the guideline ↗</a></p>
    </section>`;
  };
  main.innerHTML = `
    <div class="stack-lg">
      <div class="stack" style="gap:8px">
        <nav class="small muted" aria-label="Breadcrumb"><a href="#topics" style="color:var(--muted)">Topics</a></nav>
        <h1>National guidance: key points</h1>
        <p class="muted">National guidance takes precedence over the regional text where they differ. Points marked <span class="pill amber">Verify</span> come from secondary summaries and must be checked against the full guideline before clinical use.</p>
      </div>
      ${block("bsr2025")}${block("bsr2019")}${block("mhra2023")}${block("greenBook")}
    </div>`;
}

// ---------- Links, about, tools, search ----------

function viewLinks() {
  const res = state.res;
  const grp = (title, items) => `<section class="stack" style="gap:8px"><span class="lab">${esc(title)}</span><ul class="list">${items}</ul></section>`;
  const sc = res.sharedCare.map((r) => `<li><a target="_blank" rel="noopener" href="${esc(r.url)}"><span class="grow"><strong>${esc(r.body)}</strong><small>${esc(r.how)}</small></span>${r.todo ? '<span class="pill red">To confirm</span>' : '<span class="pill blue">Live</span>'}</a></li>`).join("");
  const nat = res.national.map((n) => `<li><a target="_blank" rel="noopener" href="${esc(n.url)}"><span class="grow"><strong>${esc(n.title)}</strong><small>${esc(n.org)} · ${esc(n.year)}${n.note ? " · " + esc(n.note) : ""}</small></span>${n.status === "update-due" ? '<span class="pill red">Update 2026/27</span>' : '<span class="chev">↗</span>'}</a></li>`).join("");
  const ev = res.evidence.items.map((e) => e.url
    ? `<li><a target="_blank" rel="noopener" href="${esc(e.url)}"><span class="grow"><strong>${esc(e.title)}</strong><small>${esc(e.why)}</small></span><span class="chev">↗</span></a></li>`
    : `<li><span class="li"><span class="grow muted">${esc(e.title)}<small>Chosen by the editorial group, without funder input</small></span></span></li>`).join("");
  main.innerHTML = `
    <div class="stack-lg">
      <div><h1>Guidance</h1><p class="muted">National guidance takes precedence over the regional text</p></div>
      ${grp("Shared care", sc)}
      <div class="notice blue small"><span>Shared care protocols belong to each Area Prescribing Committee. The app links to the live version so the current document is always the one you see.</span></div>
      ${grp("National guidance and reference", nat)}
      ${grp("Key evidence", ev)}
      <p class="small muted">${esc(res.evidence.statement)}</p>
      <p class="small"><a href="#national">Key points from the national guidelines</a> · <a href="#about">About this app</a></p>
    </div>`;
}

function viewAbout() {
  const s = state.guide.source;
  main.innerHTML = `
    <div class="stack-lg" style="max-width:720px">
      <h1>About this app</h1>
      <div class="notice amber"><span><b>Prototype.</b> Not clinically approved; no clinical safety case (DCB0129/DCB0160); the calculators are not a registered medical device. Do not use for patient care.</span></div>
      <section class="card stack" style="gap:8px"><h2>Content</h2>
        <p>Drug monographs are generated from <i>${esc(s.title.toLowerCase())}</i>, ${esc(s.edition)}, ${esc(s.revised)}, written by the Yorkshire regional rheumatology group (suggestions to Dr Gui Tran, Harrogate District Hospital). Sections follow the BNF order.</p>
        <p>National guidance (BSR 2025 csDMARD, BSR 2019 biologic safety, BSR 2023 pregnancy, MHRA JAK advice) is shown alongside and takes precedence where it differs. See <a href="#national">key points</a>.</p></section>
      <section class="card stack" style="gap:8px"><h2>Funding and editorial independence</h2>
        <p>[Sponsor statement: pending a written agreement under the ABPI Code of Practice.] The funder has no editorial input into content, drug pages, calculators or the selection of evidence.</p></section>
      <section class="card stack" style="gap:8px"><h2>Privacy</h2>
        <p>No patient data is collected, stored or transmitted. Calculator inputs stay on this device and are cleared when you leave the page. Recently viewed drugs are kept only in this browser.</p></section>
      <section class="card stack" style="gap:8px"><h2>Offline use</h2>
        <p>After the first visit the web app works offline. On a phone, use “Add to Home Screen” to install it.</p></section>
    </div>`;
}

function viewCalcIndex() {
  const recent = state.recent.map((id) => state.pages.get(id)).filter((p) => p && PAGE_CALCS[p.id]).slice(0, 3);
  main.innerHTML = `
    <div class="stack-lg">
      <div><h1>Calculators</h1><p class="muted">Add-on tools that apply the guideline's numbers</p></div>
      <div class="grad notice" style="color:#fff"><span>Prototype. Not validated and not a medical device. These apply the thresholds in the regional guideline to the numbers you enter; they support the guideline text and the SmPC, not replace them. Nothing you enter is stored or sent.</span></div>
      <div class="tiles">${CALCS.map((c) => `<a class="tile" href="#calc--${c.id}">${icon(...CALC_ICON[c.id])}<strong>${esc(c.title)}</strong><small>${esc(c.desc)}</small></a>`).join("")}</div>
      ${recent.length ? `<section class="stack" style="gap:8px"><span class="lab">Recently viewed drugs</span><ul class="list">${recent.map((p) => { const c = PAGE_CALCS[p.id][0]; return `<li><a href="#calc--${c}--${p.id}"><span class="dot ${dotFor(p)}"></span><span class="grow"><strong>${esc(p.title)}</strong><small>${esc(CALCS.find((x) => x.id === c)?.title || "")}</small></span><span class="chev">›</span></a></li>`; }).join("")}</ul></section>` : ""}
    </div>`;
}

function viewSearch() {
  main.innerHTML = `
    <div class="stack-lg">
      <div class="search-head">
        <a class="btn" style="padding:0;width:44px;flex:none" href="#home" aria-label="Back">‹</a>
        <div class="field">${ICONS.search}<label class="sr-only" for="q2">Search</label><input id="q2" type="search" placeholder="Drug, blood test or topic" value="${esc(state.q)}" autocomplete="off"></div>
      </div>
      <div class="hscroll" id="search-filters"></div>
      <ul class="list" id="search-results"></ul>
    </div>`;
  const input = main.querySelector("#q2");
  if (!isDesktop() || !state.q) input.focus();
  input.addEventListener("input", () => { state.q = input.value.trim(); renderResults(); });
  renderResults();
}

function renderResults() {
  const resultsEl = main.querySelector("#search-results");
  const filtersEl = main.querySelector("#search-filters");
  if (!resultsEl) return;
  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    filtersEl.innerHTML = "";
    resultsEl.innerHTML = `<li><span class="li"><span class="grow muted">Try a drug name, a blood test such as “neutrophils”, or a topic such as “shingles”.</span></span></li>
      ${["methotrexate", "neutrophils", "shingles", "surgery", "TPMT", "pregnancy"].map((s) => `<li><a href="#search" data-q="${esc(s)}"><span class="grow">${esc(s)}</span><span class="chev">›</span></a></li>`).join("")}`;
    resultsEl.querySelectorAll("[data-q]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); state.q = a.dataset.q; main.querySelector("#q2").value = state.q; renderResults(); }));
    return;
  }
  const items = [
    ...[...state.pages.values()].map((p) => ({ kind: p.kind === "chapter" ? "topic" : "drug", title: p.title, sub: p.kind === "chapter" ? "Topic" : GROUPS[p.group]?.short || "", text: p.text || "", href: `#page--${p.id}` })),
    ...CALCS.map((c) => ({ kind: "tool", title: c.title, sub: "Tool", text: c.desc, href: `#calc--${c.id}` })),
    ...state.res.national.map((n) => ({ kind: "topic", title: n.title, sub: n.org, text: n.note, href: "#links" })),
  ];
  const scored = items.map((it) => {
    const t = it.title.toLowerCase(), body = it.text.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (t.startsWith(term)) score += 20; else if (t.includes(term)) score += 10;
      const hits = body.split(term).length - 1;
      if (!hits && !t.includes(term)) return null;
      score += Math.min(hits, 5);
    }
    return { ...it, score, snippet: snippet(it.text, terms[0]) };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const counts = { all: scored.length, drug: 0, topic: 0, tool: 0 };
  scored.forEach((r) => counts[r.kind]++);
  filtersEl.innerHTML = [["all", "All"], ["drug", "Drugs"], ["topic", "Topics"], ["tool", "Tools"]].map(([k, l]) => `<button type="button" class="chip ${state.filter === k ? "on" : ""}" data-f="${k}">${l} ${counts[k]}</button>`).join("");
  filtersEl.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.f; renderResults(); }));
  const shown = scored.filter((r) => state.filter === "all" || r.kind === state.filter).slice(0, 40);
  resultsEl.innerHTML = shown.length
    ? shown.map((r) => `<li><a class="hit" href="${r.href}"><span class="between"><strong>${esc(r.title)}</strong><span class="pill ${r.kind === "tool" ? "red" : r.kind === "topic" ? "grey" : "blue"}">${esc(r.sub)}</span></span><small>${r.snippet}</small></a></li>`).join("")
    : `<li><span class="li"><span class="grow muted">No matches for “${esc(state.q)}”.</span></span></li>`;
}

function snippet(text, term) {
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return esc(text.slice(0, 140));
  const start = Math.max(0, i - 60);
  const s = text.slice(start, i + 110);
  const j = i - start;
  return (start ? "…" : "") + esc(s.slice(0, j)) + "<mark>" + esc(s.slice(j, j + term.length)) + "</mark>" + esc(s.slice(j + term.length)) + "…";
}

function viewNotFound() { main.innerHTML = `<h1>Not found</h1><p><a href="#home">Back to home</a></p>`; }

// ---------- Router ----------
// Hashes are plain names (#page--methotrexate, #calc--bloods--methotrexate)
// so links also work in hosts that only pass simple fragments.

function route() {
  const raw = location.hash.slice(1) || "home";
  if (raw === "main" || raw.startsWith("s-")) return; // skip link and in-page anchors
  const parts = raw.split("--");
  const section = parts[0];
  const params = new URLSearchParams();
  if (section === "drugs" && parts[1]) params.set("g", parts[1]);
  if (section === "calc" && parts[2]) params.set("drug", parts[2]);
  const page = section === "page" ? state.pages.get(parts[1]) : null;
  const activeNav = section === "page" ? (page?.kind === "chapter" ? "topics" : "drugs")
    : section === "national" ? "topics" : section === "about" ? "links" : section === "search" ? "home" : section;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const active = a.dataset.nav === activeNav;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  switch (section) {
    case "home": viewHome(); break;
    case "drugs": viewDrugs(params); break;
    case "topics": viewTopics(); break;
    case "page": viewPage(parts[1]); break;
    case "national": viewNational(); break;
    case "links": viewLinks(); break;
    case "about": viewAbout(); break;
    case "search": viewSearch(); break;
    case "calc":
      if (parts[1]) { const c = CALCS.find((x) => x.id === parts[1]); if (c) renderCalc(main, c, params, state); else viewNotFound(); }
      else viewCalcIndex();
      break;
    default: viewNotFound();
  }
  const title = main.querySelector("h1")?.textContent;
  document.title = title && section !== "home" ? `${title} · DMARD Guide` : "Yorkshire DMARD Guide";
  if (section !== "search") { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
}

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  state.q = document.getElementById("q").value.trim();
  if (location.hash === "#search") viewSearch(); else location.hash = "#search";
});
document.getElementById("q").addEventListener("input", (e) => {
  state.q = e.target.value.trim();
  if (state.q.length >= 2) { if (location.hash === "#search") renderResults(); else location.hash = "#search"; }
});

window.addEventListener("hashchange", route);
load().then(route).catch((err) => { main.innerHTML = `<div class="notice red"><span>Could not load content: ${esc(err.message)}</span></div>`; });

if ("serviceWorker" in navigator && location.protocol !== "file:" && !window.__DMARD_DATA__) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
