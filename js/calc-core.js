// Pure calculation functions for the calculator add-on.
// No DOM access here so everything can be unit-tested with `node --test`.
// Every threshold cites its source: "YG" = Yorkshire regional DMARD
// guideline 8th ed. (March 2024), drug page / section named alongside.

// ---------- Renal function ----------

/** Cockcroft–Gault creatinine clearance (mL/min), creatinine in µmol/L. */
export function crclCockcroftGault({ age, weightKg, creatinineUmol, sex }) {
  if (!(age > 0 && weightKg > 0 && creatinineUmol > 0)) return null;
  const k = sex === "F" ? 1.04 : 1.23;
  return ((140 - age) * weightKg * k) / creatinineUmol;
}

/** CKD-EPI 2021 (race-free) eGFR (mL/min/1.73m²), creatinine in µmol/L. */
export function egfrCkdEpi2021({ age, creatinineUmol, sex }) {
  if (!(age > 0 && creatinineUmol > 0)) return null;
  const scr = creatinineUmol / 88.4;
  const female = sex === "F";
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const r = scr / kappa;
  return 142 * Math.min(r, 1) ** alpha * Math.max(r, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
}

// Renal dosing rules transcribed from each drug's "Renal impairment" or
// "Additional information" row (YG). `rules` are checked in order; the
// first match applies. Drugs not listed here show the guideline text only.
export const RENAL_RULES = {
  methotrexate: {
    name: "Methotrexate",
    rules: [
      { below: 10, level: "stop", text: "CrCl <10 mL/min: not recommended (severe renal impairment)." },
      { below: 20, level: "caution", text: "CrCl 10–20 mL/min: reduce dose by 50%." },
      { below: 50, level: "caution", text: "CrCl 20–50 mL/min: consider dose reduction." },
    ],
  },
  baricitinib: {
    name: "Baricitinib",
    rules: [
      { below: 30, level: "stop", text: "CrCl <30 mL/min: do not use." },
      { below: 60, level: "caution", text: "CrCl 30–60 mL/min: 2 mg once daily." },
    ],
  },
  tofacitinib: {
    name: "Tofacitinib",
    rules: [{ below: 30, level: "caution", text: "CrCl <30 mL/min: maximum dose 5 mg once daily." }],
  },
  filgotinib: {
    name: "Filgotinib",
    rules: [
      { below: 30, level: "stop", text: "CrCl <30 mL/min is listed as an indication for stopping." },
      { below: 60, level: "caution", text: "Moderate renal impairment: reduce dose to 100 mg once daily." },
    ],
  },
  upadacitinib: { name: "Upadacitinib", rules: [], none: "No dose adjustment stated." },
  apremilast: {
    name: "Apremilast",
    rules: [{ below: 30, level: "caution", text: "CrCl <30 mL/min: titrate using morning dose only, to max 30 mg once daily." }],
  },
  "mycophenolate-mofetil": {
    name: "Mycophenolate mofetil",
    rules: [{ below: 25, level: "caution", text: "GFR <25 mL/min: start 250 mg bd and titrate gradually, not exceeding 1 g bd." }],
  },
};

export function renalAdvice(drugId, crcl) {
  const entry = RENAL_RULES[drugId];
  if (!entry || crcl == null) return null;
  for (const r of entry.rules) if (crcl < r.below) return { level: r.level, text: r.text };
  return { level: "ok", text: entry.none || "No renal dose adjustment triggered by this value." };
}

// ---------- Blood result checker ----------

// Standard csDMARD stop thresholds (YG: azathioprine, methotrexate,
// leflunomide, mycophenolate, sulfasalazine, ciclosporin pages).
const STANDARD = [
  { id: "wcc", label: "White cells", unit: "×10⁹/L", stopIf: (v) => v < 3.5, rule: "<3.5" },
  { id: "neut", label: "Neutrophils", unit: "×10⁹/L", stopIf: (v) => v < 1.6, rule: "<1.6 (or below local range)" },
  { id: "plt", label: "Platelets", unit: "×10⁹/L", stopIf: (v) => v < 140, rule: "<140 (or below local range)" },
  { id: "eos", label: "Eosinophils", unit: "×10⁹/L", stopIf: (v) => v > 0.5, rule: ">0.5" },
  { id: "alt", label: "ALT or AST (highest)", unit: "U/L", stopIf: (v) => v > 100, rule: ">100",
    trend: { id: "altBase", label: "baseline ALT/AST", stopIf: (v, b) => v >= 2 * b, rule: "doubled from baseline" } },
  { id: "alb", label: "Albumin", unit: "g/L", stopIf: (v) => v < 30, rule: "<30 (unexplained fall)" },
  { id: "mcv", label: "MCV", unit: "fL", stopIf: (v) => v > 105, rule: ">105" },
];

const BP = { id: "bp", label: "Blood pressure", unit: "mmHg", kind: "bp", rule: ">160/95",
  stopIf: (v) => v.sys > 160 || v.dia > 95 };

const JAK_COMMON = [
  { id: "hb", label: "Haemoglobin", unit: "g/L", stopIf: (v) => v < 80, rule: "<80 g/L (8 g/dL)" },
  { id: "anc", label: "Neutrophils (ANC)", unit: "×10⁹/L", stopIf: (v) => v < 1.0, rule: "<1.0" },
  { id: "alc", label: "Lymphocytes (ALC)", unit: "×10⁹/L", stopIf: (v) => v < 0.5, rule: "<0.5" },
];
const JAK_LIVER_RENAL = [
  { id: "altx", label: "ALT/AST (× upper limit of normal)", unit: "× ULN", stopIf: (v) => v > 3, rule: ">3 × ULN" },
  { id: "crcl", label: "Creatinine clearance", unit: "mL/min", stopIf: (v) => v < 30, rule: "<30" },
];

export const BLOOD_RULESETS = {
  methotrexate: { name: "Methotrexate", params: STANDARD,
    note: "Also stop for: oral ulceration, unusual bruising, rash, nausea, alopecia, new respiratory symptoms including cough, fever. Consider the need for folinic acid rescue." },
  azathioprine: { name: "Azathioprine", params: STANDARD,
    note: "Also stop for: mouth/throat ulceration, unexplained bruising or bleeding, fever/nausea/vomiting/diarrhoea with active infection, diffuse alopecia." },
  leflunomide: { name: "Leflunomide", params: [...STANDARD, BP],
    note: "Also stop for: ulcerative stomatitis, skin/mucosal reaction (washout: cholestyramine 8 g tds for 11 days), peripheral neuropathy, breathlessness or infection (CXR ± PFT)." },
  "mycophenolate-mofetil": { name: "Mycophenolate mofetil", params: STANDARD,
    note: "Patients should report signs of bone marrow suppression (infection, unexplained bruising or bleeding) immediately." },
  sulfasalazine: { name: "Sulfasalazine", params: STANDARD,
    note: "Interrupt and test bloods for sore throat, fever, malaise, pallor, purpura, jaundice or unexpected illness." },
  cyclosporine: { name: "Ciclosporin", params: [
    ...STANDARD,
    { ...BP, rule: ">160/95 or risen >20 mmHg from baseline",
      stopIf: (v, b) => v.sys > 160 || v.dia > 95 || (b && (v.sys - b.sys > 20 || v.dia - b.dia > 20)),
      baseline: true },
    { id: "k", label: "Potassium", unit: "mmol/L", stopIf: (v) => v > 5.5, rule: ">5.5" },
    { id: "crclPct", label: "Creatinine clearance", unit: "mL/min", stopIf: (v, b) => b && v <= 0.7 * b,
      rule: "30% or more below baseline: reduce dose or stop", baseline: true },
  ], note: "Also: ankle swelling, headache (check BP), tremor, gingival hyperplasia, hirsutism, confusion." },
  cyclophosphamide: { name: "Cyclophosphamide", params: [STANDARD[1], STANDARD[2]],
    note: "FBC 10 days after each pulse (nadir) and immediately before the next pulse. A lower nadir is acceptable if recovered before the next dose." },
  baricitinib: { name: "Baricitinib", params: [...JAK_COMMON, ...JAK_LIVER_RENAL],
    note: "Also stop for: suspected DVT/PE, MACE or cancer; herpes zoster/simplex; infection not responding to treatment; pregnancy." },
  filgotinib: { name: "Filgotinib", params: [...JAK_COMMON, ...JAK_LIVER_RENAL],
    note: "Hb/ANC/ALC: can restart once values recover above threshold. Also stop for: suspected DVT/PE, MACE or cancer; herpes zoster/simplex; pregnancy." },
  upadacitinib: { name: "Upadacitinib", params: JAK_COMMON,
    note: "Can restart once values recover above threshold. Also stop for: serious infection, pregnancy, abdominal symptoms suggesting perforation." },
  tofacitinib: { name: "Tofacitinib", params: [
    { id: "alc", label: "Lymphocytes (ALC)", unit: "×10⁹/L", rule: "<0.5 repeat within 7 days; 0.5–0.75 on 2 sequential tests",
      grade: (v) => v < 0.5 ? ["stop", "<0.5: repeat within 7 days and stop if still <0.5."]
        : v < 0.75 ? ["caution", "0.5–0.75: stop if this is the 2nd sequential value in this range; restart when >0.75."] : null },
    { id: "anc", label: "Neutrophils (ANC)", unit: "×10⁹/L", rule: "<0.5 repeat within 7 days; 0.5–1.0 on 2 sequential tests",
      grade: (v) => v < 0.5 ? ["stop", "<0.5: repeat within 7 days and stop if still <0.5."]
        : v < 1.0 ? ["caution", "0.5–1.0: stop if this is the 2nd sequential value in this range; restart when >1.0."] : null },
    { id: "hb", label: "Haemoglobin", unit: "g/L", rule: "<80 g/L or fall >20 g/L", baseline: true,
      stopIf: (v, b) => v < 80 || (b != null && b - v > 20) },
  ], note: "Also stop for: serious infection, pregnancy, abdominal symptoms suggesting perforation, increased shortness of breath." },
};

/**
 * values: { [paramId]: number | {sys, dia} }, baselines: same shape.
 * Returns { overall, results: [{id,label,status,detail}] } where
 * status is "stop" | "caution" | "ok" | "missing".
 */
export function checkBloods(drugId, values = {}, baselines = {}) {
  const set = BLOOD_RULESETS[drugId];
  if (!set) throw new Error(`No blood ruleset for ${drugId}`);
  const results = set.params.map((p) => {
    const v = values[p.id];
    const b = baselines[p.id];
    const present = p.kind === "bp" ? v && v.sys > 0 && v.dia > 0 : typeof v === "number" && !Number.isNaN(v);
    if (!present) return { id: p.id, label: p.label, status: "missing", detail: `Threshold: ${p.rule}` };
    if (p.grade) {
      const g = p.grade(v);
      return { id: p.id, label: p.label, status: g ? g[0] : "ok", detail: g ? g[1] : `Not below ${p.rule.split(";")[0]}` };
    }
    if (p.stopIf(v, b)) return { id: p.id, label: p.label, status: "stop", detail: `Meets stop criterion: ${p.rule}` };
    if (p.trend && typeof values[p.trend.id] === "number" && p.trend.stopIf(v, values[p.trend.id])) {
      return { id: p.id, label: p.label, status: "stop", detail: `Sudden increase: ${p.trend.rule}` };
    }
    return { id: p.id, label: p.label, status: "ok", detail: `Within threshold (${p.rule})` };
  });
  const overall = results.some((r) => r.status === "stop") ? "stop"
    : results.some((r) => r.status === "caution") ? "caution"
    : results.every((r) => r.status === "missing") ? "missing" : "ok";
  return { overall, results, note: set.note };
}

// ---------- Weight-based dosing ----------

export function roundTo(x, step) {
  return Math.round(x / step) * step;
}

/** Hydroxychloroquine: aim ≤5 mg/kg/day actual body weight (YG). */
export function hcqRegimens(weightKg) {
  if (!(weightKg > 0)) return null;
  const maxDaily = 5 * weightKg;
  const options = [
    { label: "200 mg once daily", avg: 200 },
    { label: "200 mg and 400 mg on alternate days", avg: 300 },
    { label: "400 mg once daily (or 200 mg bd)", avg: 400 },
  ].map((o) => ({ ...o, mgPerKg: o.avg / weightKg, withinLimit: o.avg <= maxDaily + 1e-9 }));
  return { maxDaily, options };
}

/** Azathioprine target up to 2.5 mg/kg/day (YG), rounded to 25 mg. */
export function azathioprineDose(weightKg) {
  if (!(weightKg > 0)) return null;
  const target = roundTo(2.5 * weightKg, 25);
  return { exact: 2.5 * weightKg, target, liveVaccineThreshold: 3 * weightKg };
}

/** Ciclosporin (RA): start 1–2 mg/kg/day in 2 divided doses, max 3–4 mg/kg/day (YG). */
export function ciclosporinDose(weightKg) {
  if (!(weightKg > 0)) return null;
  return {
    startLow: roundTo(1 * weightKg, 25),
    startHigh: roundTo(2 * weightKg, 25),
    max3: roundTo(3 * weightKg, 25),
    max4: roundTo(4 * weightKg, 25),
  };
}

/** Tocilizumab IV (RA): 8 mg/kg every 4 weeks, max 800 mg (YG). */
export function tocilizumabIvDose(weightKg) {
  if (!(weightKg > 0)) return null;
  const raw = 8 * weightKg;
  return { raw, dose: Math.min(raw, 800), capped: raw > 800 };
}

/** Infliximab IV: 3 mg/kg (RA) or 5 mg/kg (AS/PsA) (YG). */
export function infliximabDose(weightKg, mgPerKg) {
  if (!(weightKg > 0)) return null;
  const dose = weightKg * mgPerKg;
  return { dose, vials: Math.ceil(dose / 100) };
}

/** Methotrexate weekly oral dose as 2.5 mg tablets; max 30 mg weekly (YG). */
export function methotrexateTablets(weeklyMg) {
  if (!(weeklyMg > 0)) return null;
  const tablets = weeklyMg / 2.5;
  return {
    tablets,
    wholeTablets: Number.isInteger(Math.round(tablets * 1000) / 1000),
    overMax: weeklyMg > 30,
  };
}

// ---------- Corticosteroids ----------

// Anti-inflammatory equivalence to prednisolone 5 mg (BNF).
export const STEROIDS = {
  prednisolone: { name: "Prednisolone", equiv: 5 },
  hydrocortisone: { name: "Hydrocortisone", equiv: 20 },
  methylprednisolone: { name: "Methylprednisolone", equiv: 4 },
  dexamethasone: { name: "Dexamethasone", equiv: 0.75 },
  deflazacort: { name: "Deflazacort", equiv: 6 },
};

export function toPrednisolone(drug, mg) {
  const s = STEROIDS[drug];
  if (!s || !(mg >= 0)) return null;
  return (mg / s.equiv) * 5;
}

export function convertSteroid(drug, mg) {
  const pred = toPrednisolone(drug, mg);
  if (pred == null) return null;
  return Object.entries(STEROIDS).map(([id, s]) => ({ id, name: s.name, mg: (pred / 5) * s.equiv }));
}

/** Flags for a daily prednisolone-equivalent dose taken for `weeks`. */
export function steroidFlags(predMg, weeks, expectedWeeks = weeks) {
  const flags = [];
  if (predMg >= 7.5 && expectedWeeks >= 13) {
    flags.push({ id: "bone", level: "caution", source: "YG Corticosteroids",
      text: "≥7.5 mg/day expected for ≥3 months: consider bone protection. High-risk patients (previous fragility fracture, age >65) start an oral bisphosphonate at steroid initiation." });
  }
  if (weeks > 3) {
    flags.push({ id: "adrenal", level: "caution", source: "YG Corticosteroids",
      text: "Treatment >3 weeks: risk of adrenal suppression. Taper gradually; do not stop abruptly. Issue a blue steroid treatment card." });
  }
  if (predMg >= 5 && weeks >= 4) {
    flags.push({ id: "card", level: "caution", source: "NHS England National Patient Safety Alert (2020)",
      text: "≥5 mg prednisolone-equivalent for ≥4 weeks: issue a Steroid Emergency Card and give sick-day rules advice." });
  }
  if ((predMg >= 40 && weeks > 1) || (predMg >= 20 && weeks > 2)) {
    flags.push({ id: "live", level: "stop", source: "YG Vaccination (Green Book)",
      text: "High-dose steroids: avoid live vaccines until at least 3 months after stopping." });
  }
  if (weeks > 4) {
    flags.push({ id: "periop", level: "info", source: "YG Corticosteroids",
      text: "Glucocorticoids >1 month: may need increased steroid cover for surgery." });
  }
  return flags;
}

/**
 * Example taper schedule. Reduce by `step` mg every `intervalDays` until
 * `slowBelow`, then by `slowStep` mg, down to `target` mg.
 */
export function taperSchedule({ start, step, intervalDays, slowBelow = 0, slowStep = step, target = 0, startDate }) {
  if (!(start > 0 && step > 0 && intervalDays > 0) || target < 0 || target >= start) return [];
  const rows = [];
  let dose = start;
  let day = 0;
  const base = startDate ? new Date(startDate + "T00:00:00Z") : null;
  while (rows.length < 200) {
    rows.push({ dose, day, date: base ? addDays(base, day) : null });
    if (dose <= target) break;
    const s = dose <= slowBelow ? slowStep : step;
    dose = Math.max(target, roundTo(dose - s, 0.5));
    day += intervalDays;
  }
  return rows;
}

// ---------- Dates ----------

export function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// ---------- Peri-operative planner ----------

// YG Section 8, Table 3. `week` = week (after the last dose) in which to
// schedule surgery; `halfLifeDays` null where the table gives none.
export const PERIOP = {
  adalimumab: { name: "Adalimumab", interval: "Every 2 weeks", week: 3, halfLifeDays: 14 },
  "abatacept-iv": { name: "Abatacept IV", interval: "Monthly", week: 5, halfLifeDays: 14 },
  "abatacept-sc": { name: "Abatacept SC", interval: "Weekly", week: 2, halfLifeDays: 14 },
  "certolizumab-2": { name: "Certolizumab (2-weekly)", interval: "Every 2 weeks", week: 3, halfLifeDays: 14 },
  "certolizumab-4": { name: "Certolizumab (4-weekly)", interval: "Every 4 weeks", week: 5, halfLifeDays: 14 },
  etanercept: { name: "Etanercept", interval: "Weekly or twice weekly", week: 2, halfLifeDays: 3 },
  golimumab: { name: "Golimumab", interval: "Every 4 weeks", week: 5, halfLifeDays: 14 },
  "infliximab-4": { name: "Infliximab (4-weekly)", interval: "Every 4 weeks", week: 5, halfLifeDays: 9 },
  "infliximab-6": { name: "Infliximab (6-weekly)", interval: "Every 6 weeks", week: 7, halfLifeDays: 9 },
  "infliximab-8": { name: "Infliximab (8-weekly)", interval: "Every 8 weeks", week: 9, halfLifeDays: 9 },
  ixekizumab: { name: "Ixekizumab", interval: "Every 4 weeks", week: 5, halfLifeDays: 13 },
  rituximab: { name: "Rituximab", interval: "Two doses 2 weeks apart, ≥4 months between courses", months: [4, 7], halfLifeDays: 18 },
  sarilumab: { name: "Sarilumab", interval: "Every 2 weeks", week: 3, halfLifeDays: 21 },
  secukinumab: { name: "Secukinumab", interval: "Every 4 weeks", week: 5, halfLifeDays: 27 },
  ustekinumab: { name: "Ustekinumab", interval: "Every 12 weeks", week: 13, halfLifeDays: 21 },
  "tocilizumab-iv": { name: "Tocilizumab IV", interval: "Every 4 weeks", week: 5, halfLifeDays: 13,
    extra: "Stop IV tocilizumab at least 4 weeks before surgery." },
  "tocilizumab-sc": { name: "Tocilizumab SC", interval: "Weekly / alternate weeks", week: 3, halfLifeDays: 13,
    extra: "Stop SC tocilizumab at least 2 weeks before surgery." },
  apremilast: { name: "Apremilast", interval: "Daily", week: 1, halfLifeDays: 9 / 24 },
  baricitinib: { name: "Baricitinib", interval: "Daily", week: 1, halfLifeDays: 12.5 / 24 },
  tofacitinib: { name: "Tofacitinib", interval: "Daily", week: 1, halfLifeDays: 3 / 24 },
  risankizumab: { name: "Risankizumab", gap: true },
  filgotinib: { name: "Filgotinib", gap: true },
  upadacitinib: { name: "Upadacitinib", gap: true },
  avacopan: { name: "Avacopan", gap: true },
};

/** Surgery window relative to the last dose, and whether `surgeryDate` falls in it. */
export function periopPlan(drugId, lastDose, surgeryDate) {
  const d = PERIOP[drugId];
  if (!d) return null;
  if (d.gap) return { drug: d, gap: true };
  const last = new Date(lastDose + "T00:00:00Z");
  let from, to;
  if (d.months) {
    from = addMonths(last, d.months[0]);
    to = addMonths(last, d.months[1]);
  } else {
    from = addDays(last, (d.week - 1) * 7);
    to = addDays(last, d.week * 7 - 1);
  }
  const fiveHalfLives = d.halfLifeDays ? addDays(last, Math.ceil(5 * d.halfLifeDays)) : null;
  let fit = null;
  if (surgeryDate) {
    const s = new Date(surgeryDate + "T00:00:00Z");
    fit = s < from ? "early" : s > to ? "late" : "in";
  }
  return { drug: d, from, to, fiveHalfLives, fit };
}

// ---------- Monitoring schedule ----------

// From each drug's "Routine monitoring" row (YG).
export const SCHEDULES = {
  standard: { name: "Methotrexate, azathioprine, leflunomide, mycophenolate, sulfasalazine",
    fortnightlyAfterStableDays: 42, monthly: 3, thenEveryDays: 84 },
  cyclosporine: { name: "Ciclosporin", fortnightlyAfterStableDays: 0, monthly: 4, thenEveryDays: 91,
    extra: "Check BP with every blood test." },
  penicillamine: { name: "Penicillamine", fortnightlyUntilMonths: 2, monthlyUntilMonths: 6, thenEveryDays: 91 },
};

/**
 * Blood test dates from `startDate` (start or dose change) given the date
 * the dose became stable, for `months` months.
 */
export function monitoringSchedule(kind, startDate, stableDate = startDate, months = 12) {
  const s = SCHEDULES[kind];
  if (!s || !startDate) return [];
  const start = new Date(startDate + "T00:00:00Z");
  const stable = new Date((stableDate || startDate) + "T00:00:00Z");
  const end = addMonths(start, months);
  const rows = [];
  let d = addDays(start, 14);
  let fortnightlyEnd, monthlyCount;
  if (s.fortnightlyUntilMonths) {
    fortnightlyEnd = addMonths(start, s.fortnightlyUntilMonths);
  } else {
    fortnightlyEnd = addDays(stable < start ? start : stable, s.fortnightlyAfterStableDays);
  }
  while (d <= fortnightlyEnd && d <= end) {
    rows.push({ date: d, phase: "Every 2 weeks" });
    d = addDays(d, 14);
  }
  let last = rows.length ? rows[rows.length - 1].date : start;
  if (s.monthlyUntilMonths) {
    const monthlyEnd = addMonths(start, s.monthlyUntilMonths);
    for (let m = addMonths(last, 1); m <= monthlyEnd && m <= end; m = addMonths(m, 1)) {
      rows.push({ date: m, phase: "Monthly" });
      last = m;
    }
  } else {
    monthlyCount = s.monthly;
    for (let i = 1; i <= monthlyCount; i++) {
      const m = addMonths(last, 1);
      if (m > end) break;
      rows.push({ date: m, phase: "Monthly" });
      last = m;
    }
  }
  for (let q = addDays(last, s.thenEveryDays); q <= end; q = addDays(q, s.thenEveryDays)) {
    rows.push({ date: q, phase: s.thenEveryDays === 84 ? "Every 12 weeks" : "Every 3 months" });
  }
  return rows;
}
