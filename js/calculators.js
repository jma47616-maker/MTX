import {
  BLOOD_RULESETS, checkBloods, crclCockcroftGault, egfrCkdEpi2021, RENAL_RULES, renalAdvice,
  hcqRegimens, azathioprineDose, ciclosporinDose, tocilizumabIvDose, infliximabDose, methotrexateTablets,
  STEROIDS, convertSteroid, toPrednisolone, steroidFlags, taperSchedule,
  PERIOP, periopPlan, SCHEDULES, monitoringSchedule, isoDate,
} from "./calc-core.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, dp = 0) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("en-GB", { maximumFractionDigits: dp, minimumFractionDigits: 0 }));
const date = (d) => d ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–";
const num = (form, name) => {
  const el = form.elements[name];
  if (!el || el.value.trim() === "") return undefined;
  const v = parseFloat(el.value);
  return Number.isNaN(v) ? undefined : v;
};
const STATUS_TEXT = { stop: "STOP", caution: "CHECK", ok: "OK", missing: "–", info: "INFO" };
const statusPill = (s) => `<span class="status ${s}">${STATUS_TEXT[s] || s}</span>`;
const today = () => new Date().toISOString().slice(0, 10);

function field(name, label, { type = "number", hint = "", step = "any", value = "", attrs = "", wide = false } = {}) {
  return `<div class="field${wide ? " wide" : ""}"><label for="f-${name}">${label}${hint ? ` <span class="hint">${hint}</span>` : ""}</label>
    <input id="f-${name}" name="${name}" type="${type}" inputmode="${type === "number" ? "decimal" : "text"}" step="${step}" value="${esc(value)}" ${attrs}></div>`;
}
function select(name, label, options, selected, { wide = false } = {}) {
  return `<div class="field${wide ? " wide" : ""}"><label for="f-${name}">${label}</label>
    <select id="f-${name}" name="${name}">${options.map(([v, t]) => `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
}
function bind(el, form, update) {
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (e) => e.preventDefault());
  update();
}
function pageLink(state, id, text) {
  return state.pages.has(id) ? `<a href="#/page/${id}">${text || "Guideline page: " + esc(state.pages.get(id).title)}</a>` : "";
}

// ---------- 1. Blood result checker ----------

function renderBloods(el, params, state) {
  const ids = Object.keys(BLOOD_RULESETS);
  let drug = ids.includes(params.get("drug")) ? params.get("drug") : "methotrexate";
  el.innerHTML = `<form class="card" id="cform">
      <div class="form">${select("drug", "Drug", ids.map((id) => [id, BLOOD_RULESETS[id].name]), drug, { wide: true })}</div>
      <div id="params" class="form" style="margin-top:12px"></div>
    </form>
    <div class="out" id="out" aria-live="polite"></div>`;
  const form = el.querySelector("#cform");
  const paramsEl = el.querySelector("#params");

  function drawFields() {
    const set = BLOOD_RULESETS[drug];
    paramsEl.innerHTML = set.params.map((p) => {
      if (p.kind === "bp") {
        const one = (pre, lbl) => `<div class="field"><label>${lbl} <span class="hint">mmHg</span></label><div class="bp">
          <input name="${pre}sys" type="number" inputmode="decimal" aria-label="${lbl} systolic" placeholder="sys">/<input name="${pre}dia" type="number" inputmode="decimal" aria-label="${lbl} diastolic" placeholder="dia"></div></div>`;
        return one("", "Blood pressure") + (p.baseline ? one("b_", "Baseline BP") : "");
      }
      let html = field(p.id, p.label, { hint: p.unit });
      if (p.baseline) html += field("b_" + p.id, `Baseline ${p.label.toLowerCase()}`, { hint: p.unit });
      if (p.trend) html += field(p.trend.id, "Baseline ALT/AST", { hint: "U/L, optional" });
      return html;
    }).join("");
  }

  function update(e) {
    if (e && e.target.name === "drug") { drug = e.target.value; drawFields(); }
    const set = BLOOD_RULESETS[drug];
    const values = {}, base = {};
    for (const p of set.params) {
      if (p.kind === "bp") {
        const v = { sys: num(form, "sys"), dia: num(form, "dia") };
        if (v.sys && v.dia) values.bp = v;
        const b = { sys: num(form, "b_sys"), dia: num(form, "b_dia") };
        if (b.sys && b.dia) base.bp = b;
      } else {
        values[p.id] = num(form, p.id);
        base[p.id] = num(form, "b_" + p.id);
        if (p.trend) values[p.trend.id] = num(form, p.trend.id);
      }
    }
    const r = checkBloods(drug, values, base);
    const head = {
      stop: ["stop", "<b>Stop criterion met.</b> Withhold the drug and contact the local rheumatology service."],
      caution: ["warn", "<b>Check required.</b> See the detail below and the guideline page."],
      ok: ["ok", "<b>No blood stop criteria met</b> for the values entered. Also look at trends and local reference ranges."],
      missing: ["info", "Enter the latest results. Leave a box blank if the test wasn't done."],
    }[r.overall];
    el.querySelector("#out").innerHTML = `
      <div class="notice ${head[0]}">${head[1]}</div>
      <div class="card"><table class="data"><thead><tr><th>Test</th><th>Result</th><th>Detail</th></tr></thead><tbody>
        ${r.results.map((x) => `<tr><td>${esc(x.label)}</td><td>${statusPill(x.status)}</td><td>${esc(x.detail)}</td></tr>`).join("")}
      </tbody></table>
      <p class="small"><b>Also from the guideline:</b> ${esc(r.note)}</p>
      <p class="small">${pageLink(state, drug)}</p></div>`;
  }
  drawFields();
  bind(el, form, update);
}

// ---------- 2. Renal function ----------

function renderRenal(el, params, state) {
  const sel = params.get("drug");
  el.innerHTML = `<form class="card" id="cform"><div class="form">
      ${field("age", "Age", { hint: "years" })}
      ${select("sex", "Sex", [["M", "Male"], ["F", "Female"]], "M")}
      ${field("weight", "Weight", { hint: "kg" })}
      ${field("creat", "Serum creatinine", { hint: "µmol/L" })}
    </div></form><div class="out" id="out" aria-live="polite"></div>`;
  const form = el.querySelector("#cform");
  bind(el, form, () => {
    const age = num(form, "age"), weightKg = num(form, "weight"), creatinineUmol = num(form, "creat"), sex = form.sex.value;
    const crcl = crclCockcroftGault({ age, weightKg, creatinineUmol, sex });
    const egfr = egfrCkdEpi2021({ age, creatinineUmol, sex });
    const ids = Object.keys(RENAL_RULES).sort((a, b) => (b === sel) - (a === sel));
    el.querySelector("#out").innerHTML = `
      <div class="kpis">
        <div class="kpi"><small>Creatinine clearance (Cockcroft–Gault)</small><span class="big">${fmt(crcl)}</span> mL/min</div>
        <div class="kpi"><small>eGFR (CKD-EPI 2021)</small><span class="big">${fmt(egfr)}</span> mL/min/1.73m²</div>
      </div>
      <p class="small muted">Renal dose adjustments in the guideline and SmPCs use creatinine clearance. Cockcroft–Gault uses actual body weight here; consider ideal or adjusted body weight in obesity.</p>
      <div class="card"><table class="data"><thead><tr><th>Drug</th><th>Status</th><th>Guideline advice at this CrCl</th></tr></thead><tbody>
      ${ids.map((id) => {
        const a = renalAdvice(id, crcl);
        return `<tr ${id === sel ? 'style="font-weight:600"' : ""}><td>${pageLink(state, id, esc(RENAL_RULES[id].name)) || esc(RENAL_RULES[id].name)}</td>
          <td>${a ? statusPill(a.level) : statusPill("missing")}</td><td>${a ? esc(a.text) : "Enter age, weight and creatinine."}</td></tr>`;
      }).join("")}
      </tbody></table>
      <p class="small muted">Other drugs: see the renal advice on each drug page (e.g. azathioprine, sulfasalazine and hydroxychloroquine say to consider dose reduction or avoid; seek pharmacy advice).</p></div>`;
  });
}

// ---------- 3. Weight-based dosing ----------

function renderDosing(el, params, state) {
  const focus = params.get("drug");
  el.innerHTML = `<form class="card" id="cform"><div class="form">
      ${field("weight", "Actual body weight", { hint: "kg" })}
      ${field("mtx", "Methotrexate weekly dose", { hint: "mg (oral)" })}
    </div></form><div class="out" id="out" aria-live="polite"></div>`;
  const form = el.querySelector("#cform");
  bind(el, form, () => {
    const w = num(form, "weight");
    const hcq = hcqRegimens(w), aza = azathioprineDose(w), cic = ciclosporinDose(w), toc = tocilizumabIvDose(w);
    const ifx3 = infliximabDose(w, 3), ifx5 = infliximabDose(w, 5), mtx = methotrexateTablets(num(form, "mtx"));
    const sec = (id, title, html) => `<section class="card" style="margin-bottom:12px;${focus === id ? "border-color:var(--brand);border-width:2px" : ""}" id="d-${id}">
      <h2 style="margin-top:0">${title}</h2>${html}<p class="small">${pageLink(state, id)}</p></section>`;
    const need = '<p class="muted">Enter weight.</p>';
    el.querySelector("#out").innerHTML = [
      sec("methotrexate", "Methotrexate (weekly)", mtx ? `
        <p><span class="big">${fmt(mtx.tablets, 1)}</span> × 2.5 mg tablets <b>once weekly</b>${mtx.wholeTablets ? "" : ' <span class="chip stop">Not a whole number of 2.5 mg tablets</span>'}</p>
        ${mtx.overMax ? '<div class="notice stop">Above the maximum recommended dose (30 mg weekly, oral or SC).</div>' : ""}
        <p class="small">Prescribe 2.5 mg tablets only, and specify the day of the week. Co-prescribe folic acid, not taken on methotrexate day.</p>`
        : '<p class="muted">Enter the weekly dose.</p>'),
      sec("hydroxychloroquine", "Hydroxychloroquine", hcq ? `
        <p>Aim ≤ <b>5 mg/kg/day</b> actual body weight = <b>${fmt(hcq.maxDaily)} mg/day</b> maximum average daily dose.</p>
        <table class="data"><thead><tr><th>Regimen</th><th>Average mg/kg/day</th><th></th></tr></thead><tbody>
        ${hcq.options.map((o) => `<tr><td>${esc(o.label)}</td><td>${fmt(o.mgPerKg, 1)}</td><td>${o.withinLimit ? statusPill("ok") : '<span class="status stop">Over 5 mg/kg</span>'}</td></tr>`).join("")}
        </tbody></table>` : need),
      sec("azathioprine", "Azathioprine", aza ? `
        <p>Usual maximum 2.5 mg/kg/day = ${fmt(aza.exact)} mg → <span class="big">${fmt(aza.target)} mg</span> daily (rounded to 25 mg).</p>
        <p class="small">Start 50 mg daily for a week, then increase weekly by 50 mg as tolerated. Check TPMT before starting. Live vaccines are contraindicated above 3 mg/kg/day (${fmt(aza.liveVaccineThreshold)} mg).</p>` : need),
      sec("cyclosporine", "Ciclosporin (RA)", cic ? `
        <p>Start 1–2 mg/kg/day: <b>${fmt(cic.startLow)}–${fmt(cic.startHigh)} mg/day</b> in 2 divided doses for 6 weeks.</p>
        <p>Then increase by 25 mg every 2 weeks, up to a maximum of 3–4 mg/kg/day: <b>${fmt(cic.max3)}–${fmt(cic.max4)} mg/day</b>.</p>` : need),
      sec("tocilizumab", "Tocilizumab IV (RA)", toc ? `
        <p>8 mg/kg every 4 weeks = ${fmt(toc.raw)} mg → <span class="big">${fmt(toc.dose)} mg</span>${toc.capped ? ' <span class="chip warn">capped at 800 mg</span>' : ""}</p>` : need),
      sec("infliximab", "Infliximab IV", ifx3 ? `
        <table class="data"><thead><tr><th>Indication</th><th>Dose</th><th>100 mg vials</th></tr></thead><tbody>
        <tr><td>RA: 3 mg/kg at 0, 2, 6 weeks then 8-weekly</td><td>${fmt(ifx3.dose)} mg</td><td>${ifx3.vials}</td></tr>
        <tr><td>AS / PsA: 5 mg/kg</td><td>${fmt(ifx5.dose)} mg</td><td>${ifx5.vials}</td></tr></tbody></table>` : need),
    ].join("");
    if (focus) el.querySelector(`#d-${focus}`)?.scrollIntoView?.({ block: "nearest" });
  });
}

// ---------- 4. Steroids ----------

function renderSteroids(el, params, state) {
  const opts = Object.entries(STEROIDS).map(([id, s]) => [id, s.name]);
  el.innerHTML = `
    <form class="card" id="cform">
      <h2 style="margin-top:0">Dose and duration</h2>
      <div class="form">
        ${select("drug", "Steroid", opts, "prednisolone")}
        ${field("mg", "Daily dose", { hint: "mg" })}
        ${field("weeks", "Taken so far", { hint: "weeks" })}
        ${field("expected", "Expected total course", { hint: "weeks, optional" })}
      </div>
      <h2>Taper plan (example)</h2>
      <div class="form">
        ${field("tstart", "Start taper from", { hint: "mg prednisolone" })}
        ${field("tstep", "Reduce by", { hint: "mg", value: "5" })}
        ${field("tint", "Every", { hint: "days", value: "7" })}
        ${field("tslow", "Slow down below", { hint: "mg", value: "10" })}
        ${field("tslowstep", "then reduce by", { hint: "mg", value: "1" })}
        ${field("ttarget", "Down to", { hint: "mg", value: "0" })}
        ${field("tdate", "Start date", { type: "date", value: today() })}
      </div>
    </form>
    <div class="out" id="out" aria-live="polite"></div>`;
  const form = el.querySelector("#cform");
  bind(el, form, (e) => {
    const mg = num(form, "mg"), weeks = num(form, "weeks");
    const drug = form.drug.value;
    const conv = mg != null ? convertSteroid(drug, mg) : null;
    const pred = mg != null ? toPrednisolone(drug, mg) : null;
    if (pred != null && (!e || e.target.name !== "tstart") && !form.tstart.dataset.touched) form.tstart.value = fmt(pred, 1).replace(/,/g, "");
    if (e && e.target.name === "tstart") form.tstart.dataset.touched = "1";
    const flags = pred != null && weeks != null ? steroidFlags(pred, weeks, num(form, "expected") ?? weeks) : null;
    const rows = taperSchedule({
      start: num(form, "tstart"), step: num(form, "tstep"), intervalDays: num(form, "tint"),
      slowBelow: num(form, "tslow") ?? 0, slowStep: num(form, "tslowstep") ?? num(form, "tstep"),
      target: num(form, "ttarget") ?? 0, startDate: form.tdate.value || null,
    });
    el.querySelector("#out").innerHTML = `
      ${conv ? `<div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">Equivalent doses</h2>
        <table class="data"><tbody>${conv.map((c) => `<tr ${c.id === drug ? 'style="font-weight:600"' : ""}><td>${esc(c.name)}</td><td>${fmt(c.mg, 2)} mg</td></tr>`).join("")}</tbody></table>
        <p class="small muted">Anti-inflammatory equivalence (BNF): prednisolone 5 mg ≈ hydrocortisone 20 mg ≈ methylprednisolone 4 mg ≈ dexamethasone 750 micrograms ≈ deflazacort 6 mg.</p></div>` : ""}
      ${flags ? `<div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">Safety actions</h2>
        ${flags.length ? `<table class="data"><tbody>${flags.map((f) => `<tr><td>${statusPill(f.level)}</td><td>${esc(f.text)}<br><small class="muted">${esc(f.source)}</small></td></tr>`).join("")}</tbody></table>`
          : '<p class="muted">No flags at this dose and duration.</p>'}
        <p class="small">${pageLink(state, "corticosteroids")}</p></div>` : ""}
      ${rows.length ? `<div class="card"><h2 style="margin-top:0">Example taper</h2>
        <p class="small muted">Tailor the speed of reduction to disease activity and comorbidities. Below about 5 mg, consider the risk of adrenal insufficiency.</p>
        <table class="data"><thead><tr><th>From</th><th>Day</th><th>Daily dose</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td>${date(r.date)}</td><td>${r.day}</td><td>${fmt(r.dose, 1)} mg</td></tr>`).join("")}
        </tbody></table><div class="actions"><button class="btn" type="button" onclick="window.print()">Print</button></div></div>` : ""}`;
  });
}

// ---------- 5. Peri-operative planner ----------

const PAGE_TO_PERIOP = {
  abatacept: "abatacept-iv", "certolizumab-pegol": "certolizumab-2", infliximab: "infliximab-8",
  tocilizumab: "tocilizumab-iv",
};

function renderPeriop(el, params, state) {
  const p = params.get("drug");
  const sel = PAGE_TO_PERIOP[p] || (PERIOP[p] ? p : "adalimumab");
  el.innerHTML = `<div class="notice info">csDMARDs generally do not need to be stopped peri-operatively; discuss with the patient's rheumatology consultant if concerned. Check whether glucocorticoid cover is needed.</div>
    <form class="card" id="cform"><div class="form">
      ${select("drug", "Biologic / tsDMARD", Object.entries(PERIOP).map(([id, d]) => [id, d.name + (d.gap ? " (no guideline data)" : "")]), sel, { wide: true })}
      ${field("last", "Date of last dose", { type: "date", value: today() })}
      ${field("surgery", "Planned surgery date", { type: "date", hint: "optional" })}
    </div></form><div class="out" id="out" aria-live="polite"></div>`;
  const form = el.querySelector("#cform");
  bind(el, form, () => {
    const plan = form.last.value ? periopPlan(form.drug.value, form.last.value, form.surgery.value || null) : null;
    const out = el.querySelector("#out");
    if (!plan) { out.innerHTML = '<p class="muted">Enter the date of the last dose.</p>'; return; }
    if (plan.gap) {
      out.innerHTML = `<div class="notice warn"><b>${esc(plan.drug.name)}:</b> the regional guideline table has no peri-operative data yet. Discuss with rheumatology well before surgery.</div>`;
      return;
    }
    const d = plan.drug;
    const fit = { in: ["ok", "The planned date falls within the recommended window."],
      early: ["stop", "The planned date is <b>earlier</b> than the recommended window. Consider rescheduling or discuss with rheumatology."],
      late: ["warn", "The planned date is <b>after</b> the window, so the patient may miss doses and flare. Discuss whether to give the next dose."] }[plan.fit];
    out.innerHTML = `
      ${fit ? `<div class="notice ${fit[0]}">${fit[1]}</div>` : ""}
      <div class="kpis">
        <div class="kpi"><small>Dosing interval</small><b>${esc(d.interval)}</b></div>
        <div class="kpi"><small>Schedule surgery ${d.months ? `months ${d.months[0]}–${d.months[1]}` : `in week ${d.week}`} after last dose</small><b>${date(plan.from)}<br>to ${date(plan.to)}</b></div>
        <div class="kpi"><small>5 half-lives (${d.halfLifeDays >= 1 ? fmt(d.halfLifeDays, 1) + " days" : fmt(d.halfLifeDays * 24, 1) + " hours"} each) reached</small><b>${date(plan.fiveHalfLives)}</b></div>
      </div>
      ${d.extra ? `<div class="notice warn">${esc(d.extra)}</div>` : ""}
      <p class="small">Restart only when the wound has healed and there is no infection. The interruption period should be agreed with the rheumatologist well in advance; higher-risk surgery (e.g. colonic) may warrant longer.</p>
      <p class="small">${pageLink(state, "surgery")}</p>`;
  });
}

// ---------- 6. Monitoring schedule ----------

const PAGE_TO_SCHEDULE = { cyclosporine: "cyclosporine", penicillamine: "penicillamine" };

function renderSchedule(el, params, state) {
  const p = params.get("drug");
  const kind = PAGE_TO_SCHEDULE[p] || "standard";
  el.innerHTML = `<form class="card" id="cform"><div class="form">
      ${select("kind", "Drug", Object.entries(SCHEDULES).map(([id, s]) => [id, s.name]), kind, { wide: true })}
      ${field("start", "Start or dose-change date", { type: "date", value: today() })}
      ${field("stable", "Date dose became stable", { type: "date", hint: "if different" })}
      ${field("months", "Show", { hint: "months", value: "12" })}
    </div></form><div class="out" id="out" aria-live="polite"></div>`;
  const form = el.querySelector("#cform");
  let rows = [];
  bind(el, form, () => {
    const k = form.kind.value;
    rows = monitoringSchedule(k, form.start.value, form.stable.value || form.start.value, Math.min(num(form, "months") || 12, 36));
    const s = SCHEDULES[k];
    el.querySelector("#out").innerHTML = rows.length ? `<div class="card">
      <p class="small">FBC, U&amp;E and LFT${k === "cyclosporine" ? " plus BP" : ""}. More frequent monitoring if higher risk of toxicity or clinically indicated. After any dose increase, restart fortnightly checks.</p>
      ${s.extra ? `<div class="notice info small">${esc(s.extra)}</div>` : ""}
      <table class="data"><thead><tr><th>#</th><th>Date</th><th>Phase</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${date(r.date)}</td><td>${esc(r.phase)}</td></tr>`).join("")}
      </tbody></table>
      <div class="actions"><button class="btn" type="button" id="ics">Add to calendar (.ics)</button><button class="btn" type="button" onclick="window.print()">Print</button></div>
      <p class="small">${p ? pageLink(state, p) : ""}</p></div>` : '<p class="muted">Enter a start date.</p>';
    el.querySelector("#ics")?.addEventListener("click", () => downloadIcs(rows));
  });
}

function downloadIcs(rows) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DMARD Guide//EN"];
  rows.forEach((r, i) => {
    const d = isoDate(r.date).replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:dmard-${d}-${i}@dmard-guide`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`,
      "SUMMARY:DMARD blood test", `DESCRIPTION:${r.phase} monitoring`, "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "dmard-monitoring.ics" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Registry ----------

export const CALCS = [
  { id: "bloods", icon: "🩸", title: "Blood result checker", desc: "Check FBC, LFT and other results against each drug's stop criteria", render: renderBloods },
  { id: "renal", icon: "⚗", title: "Renal function & dosing", desc: "CrCl (Cockcroft–Gault), eGFR, and renal dose advice", render: renderRenal },
  { id: "dosing", icon: "⚖", title: "Weight-based dosing", desc: "HCQ mg/kg, azathioprine, ciclosporin, tocilizumab, infliximab, methotrexate tablets", render: renderDosing },
  { id: "steroids", icon: "◐", title: "Steroid converter & taper", desc: "Equivalent doses, bone/adrenal/vaccine flags, taper plan", render: renderSteroids },
  { id: "periop", icon: "✚", title: "Peri-operative planner", desc: "When to schedule surgery after the last biologic or JAK dose", render: renderPeriop },
  { id: "schedule", icon: "📅", title: "Monitoring schedule", desc: "Blood test dates for csDMARDs, with calendar export", render: renderSchedule },
];

export function renderCalc(main, calc, params, state) {
  main.innerHTML = `
    <div class="crumbs"><a href="#/calc">Calculators</a></div>
    <h1>${esc(calc.title)}</h1>
    <div class="notice warn small calc-intro">Add-on tool. Prototype, not validated, and not a medical device. Always read the guideline text and SmPC and use clinical judgement. Nothing you enter is stored or sent.</div>
    <div id="calc-body"></div>`;
  calc.render(main.querySelector("#calc-body"), params, state);
}
