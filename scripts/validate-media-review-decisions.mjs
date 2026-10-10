import {
  buildReviewCsv, parseReviewCsv, validateImportedReviewCsv,
} from "./media-review-decisions.mjs";

function assert(value, why) {
  if (!value) throw new Error("Media review CSV audit: " + why);
}
function rejects(fn, expected) {
  let error = "";
  try { fn(); } catch (e) { error = String(e); }
  assert(error.includes(expected), "expected rejection " + expected + ", got " + error);
}
const headers = [
  "حالة المراجعة", "معرف التمرين", "الاسم العربي", "الاسم الإنجليزي",
  "المعدات", "العضلة", "معرف المرشح", "اسم المرشح", "ملصق المرشح",
  "الإطار 1", "الإطار 2", "الإطار 3",
  "قرار المدقق", "سبب القرار", "الحركة مطابقة", "المعدات مطابقة",
  "العضلة مطابقة", "الإطارات فُحصت", "إصدار المصدر",
];
const canonical = [
  ["review", "candidate-x", "سحب بالكابل", "Cable row", "cable", "back",
    "3156", "one-arm row", "pinned.jpg", "frame1", "frame2", "frame3",
    "", "", "", "", "", "", "fixed-hash"],
  ["none", "no-source-y", "تمرين بلا مصدر", "Missing option", "none", "legs",
    "", "", "", "frame1", "frame2", "frame3",
    "", "", "", "", "", "", "fixed-hash"],
];
assert(headers.length === 19 && canonical.every(row=>row.length===19),
  "test fixture contains an invalid schema");
const blank = buildReviewCsv(headers, canonical, {});
assert(blank.charCodeAt(0) === 0xFEFF, "Excel UTF-8 BOM omitted");
assert(Object.keys(validateImportedReviewCsv(blank, headers, canonical)).length === 2,
  "blank template cannot round-trip");

const decision = {
  "candidate-x": {
    decision: "recommended",
    notes: '=SUM(A1:A2)\nI checked the shoulder path and equipment "carefully".',
    checks: { movement:true, equipment:true, muscle:true, frames:true },
  },
  "no-source-y": {
    decision: "new-source",
    notes: "محتاج مصدر آخر لأن الحركة غير موجودة",
    checks: { movement:false, equipment:false, muscle:false, frames:false },
  },
};
const text = buildReviewCsv(headers, canonical, decision);
assert(text.includes("'=SUM"), "spreadsheet formula was not escaped");
const saved = validateImportedReviewCsv(text, headers, canonical);
assert(saved["candidate-x"].notes === decision["candidate-x"].notes,
  "quoted multiline/formula notes did not survive export/import");
assert(saved["candidate-x"].checks.frames && saved["candidate-x"].decision === "recommended",
  "approval checklist was lost");
assert(saved["no-source-y"].decision === "new-source",
  "missing source decision was lost");
const rows = parseReviewCsv(text);
assert(rows.length === 3 && rows[1].length === 19,
  "CSV parser mangled quoted commas, line breaks or escaped quotes");

// A partial CSV export can be merged without clearing other locally saved
// decisions; the validator returns only rows that were actually present.
const partial = buildReviewCsv(headers, canonical.slice(0,1), decision);
assert(Object.keys(validateImportedReviewCsv(partial, headers, canonical)).length === 1,
  "partial review CSV was rejected");

const mutated = (change) => {
  const duplicate = rows.map(row => row.slice());
  change(duplicate);
  return "\uFEFF" + duplicate.map(row =>
    row.map(cell => '"' + cell.replaceAll('"','""') + '"').join(",")).join("\r\n") + "\r\n";
};
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][18]="stale-commit";}),headers,canonical),
  "ملف قديم");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][6]="wrong-candidate";}),headers,canonical),
  "ملف قديم");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][9]="wrong-reference";}),headers,canonical),
  "ملف قديم");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[2]=r[1].slice();}),headers,canonical),
  "مكرر");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][12]="surprise";}),headers,canonical),
  "غير صالحة");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][14]="maybe";}),headers,canonical),
  "قائمة التحقق");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][17]="";}),headers,canonical),
  "ترشيح غير موثق");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[1][13]="too short";}),headers,canonical),
  "ترشيح غير موثق");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[2][12]="recommended";}),headers,canonical),
  "غير موجود");
rejects(()=>validateImportedReviewCsv(mutated(r=>{r[0][0]="malicious column";}),headers,canonical),
  "أعمدة");
rejects(()=>parseReviewCsv('abc,"unclosed'),"غير مغلقة");
rejects(()=>parseReviewCsv("x".repeat(1024*1024+1)),"كبير");

console.log("Media review CSV PASS: safe round-trip, Unicode/quotes, spreadsheet formula safety, import subsets, provenance, duplicates, evidence gate and schema checks.");
