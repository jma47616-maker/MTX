import { test } from "node:test";
import assert from "node:assert/strict";
import {
  crclCockcroftGault, egfrCkdEpi2021, renalAdvice, checkBloods, hcqRegimens,
  azathioprineDose, ciclosporinDose, tocilizumabIvDose, infliximabDose, methotrexateTablets,
  toPrednisolone, convertSteroid, steroidFlags, taperSchedule, periopPlan,
  monitoringSchedule, isoDate, addMonths, BLOOD_RULESETS, PERIOP,
} from "../js/calc-core.js";

const close = (a, b, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("Cockcroft-Gault", () => {
  // (140-60)*70*1.23/90 = 76.5
  close(crclCockcroftGault({ age: 60, weightKg: 70, creatinineUmol: 90, sex: "M" }), 76.53, 0.01);
  close(crclCockcroftGault({ age: 60, weightKg: 70, creatinineUmol: 90, sex: "F" }), 64.71, 0.01);
  assert.equal(crclCockcroftGault({ age: 60, weightKg: 0, creatinineUmol: 90 }), null);
});

test("CKD-EPI 2021 matches published reference values", () => {
  // Creatinine 1.0 mg/dL (88.4 µmol/L), age 50: male ≈ 92, female ≈ 69
  close(egfrCkdEpi2021({ age: 50, creatinineUmol: 88.4, sex: "M" }), 91.7, 1);
  close(egfrCkdEpi2021({ age: 50, creatinineUmol: 88.4, sex: "F" }), 68.6, 1);
});

test("renal advice bands", () => {
  assert.equal(renalAdvice("methotrexate", 8).level, "stop");
  assert.match(renalAdvice("methotrexate", 15).text, /50%/);
  assert.match(renalAdvice("methotrexate", 40).text, /consider/);
  assert.equal(renalAdvice("methotrexate", 70).level, "ok");
  assert.match(renalAdvice("baricitinib", 45).text, /2 mg/);
  assert.equal(renalAdvice("baricitinib", 25).level, "stop");
  assert.equal(renalAdvice("unknown", 25), null);
});

test("standard csDMARD bloods", () => {
  const ok = checkBloods("methotrexate", { wcc: 6, neut: 4, plt: 250, eos: 0.2, alt: 30, alb: 40, mcv: 92 });
  assert.equal(ok.overall, "ok");
  const low = checkBloods("methotrexate", { neut: 1.5 });
  assert.equal(low.overall, "stop");
  assert.equal(low.results.find((r) => r.id === "neut").status, "stop");
  // ALT 70 is below 100 but has doubled from a baseline of 30.
  const doubled = checkBloods("azathioprine", { alt: 70, altBase: 30 });
  assert.equal(doubled.results.find((r) => r.id === "alt").status, "stop");
  assert.equal(checkBloods("azathioprine", {}).overall, "missing");
  // Boundaries are strict: exactly at the threshold is not a stop.
  assert.equal(checkBloods("methotrexate", { wcc: 3.5, plt: 140, mcv: 105, alt: 100 }).overall, "ok");
});

test("leflunomide and ciclosporin extras", () => {
  assert.equal(checkBloods("leflunomide", { bp: { sys: 165, dia: 80 } }).overall, "stop");
  const cic = checkBloods("cyclosporine",
    { bp: { sys: 150, dia: 85 }, crclPct: 60, k: 5.0 },
    { bp: { sys: 125, dia: 80 }, crclPct: 90 });
  assert.equal(cic.results.find((r) => r.id === "bp").status, "stop");
  assert.equal(cic.results.find((r) => r.id === "crclPct").status, "stop");
  assert.equal(cic.results.find((r) => r.id === "k").status, "ok");
});

test("JAK inhibitor bloods (Hb in g/L)", () => {
  assert.equal(checkBloods("baricitinib", { hb: 79 }).overall, "stop");
  assert.equal(checkBloods("baricitinib", { hb: 95, anc: 2, alc: 1, altx: 1, crcl: 70 }).overall, "ok");
  assert.equal(checkBloods("tofacitinib", { alc: 0.6 }).overall, "caution");
  assert.equal(checkBloods("tofacitinib", { alc: 0.4 }).overall, "stop");
  assert.equal(checkBloods("tofacitinib", { hb: 110 }, { hb: 135 }).overall, "stop");
  for (const id of Object.keys(BLOOD_RULESETS)) assert.ok(checkBloods(id, {}).results.length > 0);
});

test("weight-based dosing", () => {
  const h = hcqRegimens(50);
  assert.equal(h.maxDaily, 250);
  assert.deepEqual(h.options.map((o) => o.withinLimit), [true, false, false]);
  assert.equal(hcqRegimens(85).options[2].withinLimit, true);
  assert.equal(azathioprineDose(70).target, 175);
  assert.deepEqual(ciclosporinDose(70), { startLow: 75, startHigh: 150, max3: 200, max4: 275 });
  assert.deepEqual(tocilizumabIvDose(120), { raw: 960, dose: 800, capped: true });
  assert.deepEqual(infliximabDose(70, 3), { dose: 210, vials: 3 });
  assert.equal(methotrexateTablets(15).tablets, 6);
  assert.equal(methotrexateTablets(35).overMax, true);
});

test("steroid conversions and flags", () => {
  assert.equal(toPrednisolone("hydrocortisone", 20), 5);
  close(toPrednisolone("dexamethasone", 6), 40, 0.001);
  assert.equal(convertSteroid("prednisolone", 10).find((r) => r.id === "methylprednisolone").mg, 8);
  const ids = (f) => f.map((x) => x.id).sort();
  assert.deepEqual(ids(steroidFlags(5, 2)), []);
  assert.deepEqual(ids(steroidFlags(10, 16)), ["adrenal", "bone", "card", "periop"]);
  assert.ok(ids(steroidFlags(40, 2)).includes("live"));
  assert.ok(!ids(steroidFlags(20, 2)).includes("live"));
  assert.ok(ids(steroidFlags(20, 3)).includes("live"));
});

test("taper schedule", () => {
  const rows = taperSchedule({ start: 20, step: 5, intervalDays: 7, slowBelow: 10, slowStep: 1, target: 5, startDate: "2026-01-01" });
  assert.deepEqual(rows.map((r) => r.dose), [20, 15, 10, 9, 8, 7, 6, 5]);
  assert.equal(isoDate(rows[1].date), "2026-01-08");
  assert.deepEqual(taperSchedule({ start: 5, step: 1, intervalDays: 7, target: 5 }), []);
});

test("peri-op planner", () => {
  const p = periopPlan("adalimumab", "2026-03-01", "2026-03-17");
  assert.equal(isoDate(p.from), "2026-03-15");
  assert.equal(isoDate(p.to), "2026-03-21");
  assert.equal(p.fit, "in");
  assert.equal(periopPlan("adalimumab", "2026-03-01", "2026-03-10").fit, "early");
  const r = periopPlan("rituximab", "2026-01-31");
  assert.equal(isoDate(r.from), "2026-05-31");
  assert.equal(isoDate(r.to), "2026-08-31");
  assert.equal(periopPlan("upadacitinib", "2026-01-01").gap, true);
  for (const id of Object.keys(PERIOP)) assert.ok(periopPlan(id, "2026-01-01"));
});

test("monitoring schedule (standard csDMARD)", () => {
  const rows = monitoringSchedule("standard", "2026-01-01", "2026-01-01", 12);
  const dates = rows.map((r) => isoDate(r.date));
  // Fortnightly to 6 weeks, monthly x3, then 12-weekly.
  assert.deepEqual(dates.slice(0, 3), ["2026-01-15", "2026-01-29", "2026-02-12"]);
  assert.deepEqual(rows.slice(3, 6).map((r) => r.phase), ["Monthly", "Monthly", "Monthly"]);
  assert.equal(dates[3], "2026-03-12");
  assert.equal(rows[6].phase, "Every 12 weeks");
  assert.equal(dates[5], "2026-05-12");
  assert.equal(dates[6], "2026-08-04");
  assert.ok(rows.every((r) => r.date <= addMonths(new Date("2026-01-01T00:00:00Z"), 12)));
});

test("addMonths clamps month ends", () => {
  assert.equal(isoDate(addMonths(new Date("2026-01-31T00:00:00Z"), 1)), "2026-02-28");
});
