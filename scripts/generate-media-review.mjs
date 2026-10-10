import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { encodeReviewCsvCell, parseReviewCsv, validateImportedReviewCsv, buildReviewCsv } from "./media-review-decisions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const manifest = read("src/data/workout-guide-manifest.json");
const media = read("src/data/exercise-media-map.json");
const arabic = read("src/data/exercise-arabic-names.json");
const report = read("src/data/exercise-media-match-report.json");
const posters = read("src/data/media-review-candidate-posters.json");

function assert(ok, message) {
  if (!ok) throw new Error("Media review audit FAILED: " + message);
}
const safe = (value) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// Never place source-controlled text directly inside a script tag.
const jsLiteral = (value) => JSON.stringify(value)
  .replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028")
  .replaceAll("\u2029", "\\u2029");
const framesBase = "https://raw.githubusercontent.com/bryllim/workout-guide/" +
  "aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/";
const mediaBase = media._meta.rawBase;
assert(mediaBase.includes(media._meta.sourceCommit), "media source must be pinned");
assert(media._meta.sourceCommit === report.sourceCommit, "source commits differ");

const rows = manifest.flatMap((exercise) => {
  const entry = media[exercise.slug];
  assert(entry, "missing media mapping for " + exercise.slug);
  if (entry.matchConfidence !== "review" && entry.matchConfidence !== "none") return [];
  const candidateId = entry.candidateSourceExerciseId ?? "";
  assert(Boolean(candidateId) === Boolean(entry.candidateSourceName),
    "incomplete candidate metadata for " + exercise.slug);
  assert(!candidateId || entry.matchConfidence === "review",
    "non-review exercise has a candidate: " + exercise.slug);
  return [{
    slug: exercise.slug,
    arabic: arabic[exercise.slug] ?? exercise.name,
    english: exercise.name,
    status: entry.matchConfidence,
    equipment: exercise.equipment,
    muscle: exercise.primaryMuscle,
    candidateId,
    candidateName: entry.candidateSourceName ?? "",
    candidatePoster: candidateId ? posters[candidateId] : "",
    // Posters and motion GIFs use the same unique source ID + asset hash
    // in the pinned dataset. Preview is opt-in and is never enabled in-app.
    candidateGif: candidateId ? posters[candidateId]
      .replace(/^images\//, "videos/").replace(/\.jpg$/, ".gif") : "",
    candidateCaution: candidateId === "3217"
      ? "نسخة modified: افحص مدى الحركة ومسار الكتفين والحوض."
      : candidateId === "3156"
        ? "مرشح بذراع واحدة وقبضة ضيقة: تحقق من المعدات وطريقة السحب."
        : candidateId === "1417"
          ? "نسخة رجل واحدة ومسار قطري: تحقق من اختلاف الحركة المستهدفة."
          : "",
    frames: exercise.frames.map((frame) => framesBase + frame.path),
  }];
});
const reviewed = rows.filter((row) => row.status === "review");
const missing = rows.filter((row) => row.status === "none");
const candidates = reviewed.filter((row) => row.candidateId);
const candidateIds = new Set(candidates.map((row) => row.candidateId));
const activeIds = new Set(Object.values(media).filter((entry) =>
  entry && (entry.matchConfidence === "exact" || entry.matchConfidence === "high")
).map((entry) => entry.sourceExerciseId));

assert(manifest.length === report.auraExerciseCount, "manifest/report count mismatch");
assert(reviewed.length === report.review && missing.length === report.none,
  "review/none counts disagree with canonical media report");
assert(reviewed.length + missing.length + report.activePreferredMedia === manifest.length,
  "coverage categories do not sum to the full catalog");
assert(candidateIds.size === candidates.length, "duplicate candidate source ID");
assert(candidates.length === report.candidateQueueAudit.remainingReviewCandidates,
  "candidate queue does not match audited count");
assert(candidateIds.size === Object.keys(posters).length,
  "candidate poster manifest contains stale or missing IDs");
for (const row of candidates) {
  assert(typeof row.candidatePoster === "string" &&
    /^images\/[0-9]{4}-[A-Za-z0-9]+\.jpg$/.test(row.candidatePoster),
    "missing pinned poster path for " + row.slug);
  assert(!activeIds.has(row.candidateId), "candidate already approved for another exercise");
  assert(/^videos\/[0-9]{4}-[A-Za-z0-9]+\.gif$/.test(row.candidateGif),
    "invalid pinned candidate GIF path for " + row.slug);
  assert(row.candidateGif.replace(/^videos\//, "images/").replace(/\.gif$/, ".jpg") === row.candidatePoster,
    "candidate GIF and poster have different source hashes: " + row.slug);
  assert(row.candidateCaution.length > 0,
    "candidate needs a specific review warning: " + row.slug);
}
const candidateUrl = (row) => row.candidatePoster ? mediaBase + row.candidatePoster : "";
const candidateGifUrl = (row) => row.candidateGif ? mediaBase + row.candidateGif : "";
const columns = [
  "حالة المراجعة", "معرف التمرين", "الاسم العربي", "الاسم الإنجليزي", "المعدات",
  "العضلة الأساسية", "معرف المرشح", "اسم المرشح", "صورة المرشح (غير معتمدة)",
  "الصورة المرجعية 1", "الصورة المرجعية 2", "الصورة المرجعية 3",
  "قرار المدقق", "سبب القرار", "الحركة مطابقة", "المعدات مطابقة",
  "العضلة مطابقة", "الإطارات فُحصت", "إصدار المصدر",
];
const csvRows = rows.map((row) => [
  row.status, row.slug, row.arabic, row.english, row.equipment, row.muscle,
  row.candidateId, row.candidateName, candidateUrl(row), ...row.frames,
  "", "", "", "", "", "", report.sourceCommit,
]);
const csvText = buildReviewCsv(columns, csvRows, {});
assert(Object.keys(validateImportedReviewCsv(csvText, columns, csvRows)).length === rows.length,
  "blank review queue must round-trip through the import validator");

const reviewKey = "aura-fit-media-review-v3-" + report.sourceCommit;
const legacyReviewKey = "aura-fit-media-review-v2-" + report.sourceCommit;
const entries = rows.map((row) => {
  const hasCandidate = Boolean(row.candidateId);
  const status = row.status === "none" ? "لا توجد مطابقة آمنة" :
    hasCandidate ? "مرشح يحتاج فحصًا" : "لا يوجد مرشح محدد";
  const review = hasCandidate ?
    '<div class="candidate"><div class="warn">مرشح غير معتمد — لا يُستخدم في التطبيق</div>' +
    '<img loading="lazy" alt="' + safe(row.candidateName) + '" src="' +
    safe(candidateUrl(row)) + '">' +
    '<p>' + safe(row.candidateName) + ' · ID ' + safe(row.candidateId) + '</p>' +
    '<p class="warn">' + safe(row.candidateCaution) + '</p>' +
    '<button type="button" class="preview-btn" data-preview-control data-src="' +
      safe(candidateGifUrl(row)) + '" aria-label="تشغيل معاينة المرشح غير المعتمد">▶ عرض الحركة المرشحة (غير معتمدة)</button>' +
    '<img class="gif-preview" data-preview-img hidden alt="معاينة حركة غير معتمدة للمرشح ' +
      safe(row.candidateName) + '">' +
    '<p class="muted small">يُحمّل GIF عند النقر فقط؛ الصورة المتحركة للمقارنة وليست دليل اعتماد.</p></div>' :
    '<p class="muted">لم تُعثر مطابقة مرشحة صالحة بعد مراجعة المصدر الحالي.</p>';
  const frameLinks = row.frames.map((url, i) =>
    '<a target="_blank" rel="noopener noreferrer" href="' + safe(url) +
    '">الإطار ' + (i + 1) + '</a>').join(" · ");
  return '<article class="exercise" data-slug="' + safe(row.slug) +
    '" data-status="' + safe(row.status) +
    '" data-candidate="' + (hasCandidate ? "yes" : "no") +
    '" data-search="' + safe([row.arabic, row.english, row.slug,
      row.equipment, row.muscle].join(" ").toLowerCase()) + '">' +
    '<h2>' + safe(row.arabic) + '</h2>' +
    '<p class="latin" dir="ltr">' + safe(row.english) + '</p>' +
    '<p class="muted">' + safe(status) + ' · ' + safe(row.equipment) +
    ' · ' + safe(row.muscle) + '</p>' +
    '<div class="comparison"><div><p>المصدر المرجعي الأصلي</p>' +
    '<img loading="lazy" alt="الإطار الأول لتمرين ' + safe(row.arabic) +
    '" src="' + safe(row.frames[0]) + '"><p class="links">' +
    frameLinks + '</p></div>' + review + '</div>' +
    '<p class="muted small">المراجعة تتطلب تطابق نمط الحركة والمعدات والعضلة المستهدفة والوضعيات.</p>' +
    '<div class="review-form">' +
      '<label>قرار المراجعة (لا يغيّر التطبيق)' +
        '<select data-decision aria-label="قرار مراجعة ' + safe(row.arabic) + '">' +
          '<option value="">لم تُراجع</option>' +
          '<option value="needs-evidence">تحتاج أدلة إضافية</option>' +
          (hasCandidate ? '<option value="rejected">استبعاد المرشح</option>' +
          '<option value="recommended">مرشح مقترح فقط (غير معتمد)</option>' : '') +
          '<option value="new-source">البحث عن مصدر مختلف</option>' +
        '</select></label>' +
      '<label>الدليل / سبب القرار' +
        '<textarea rows="3" maxlength="1200" data-notes aria-label="ملاحظات مراجعة ' +
          safe(row.arabic) + '" placeholder="صف الفرق أو دليل المطابقة قبل اتخاذ القرار"></textarea>' +
      '</label><fieldset class="review-checks"><legend>فحص المطابقة (إلزامي للترشيح)</legend>' +
        '<label><input type="checkbox" data-review-check="movement"> مطابقة نمط الحركة والمدى</label>' +
        '<label><input type="checkbox" data-review-check="equipment"> مطابقة المعدات والقبضة</label>' +
        '<label><input type="checkbox" data-review-check="muscle"> مطابقة العضلة المستهدفة</label>' +
        '<label><input type="checkbox" data-review-check="frames"> فحص بداية الحركة ووسطها ونهايتها</label>' +
      '</fieldset><p class="review-error" data-review-error role="status"></p>' +
      '<p class="muted small">الترشيح الاسترشادي يحتاج أربعة فحوص وسببًا من 20 حرفًا؛ ولا يفعّل الفيديو. صدّر CSV للاحتفاظ بالقرارات.</p>' +
    '</div>' +
    '<p class="code">' + safe(row.slug) + '</p></article>';
}).join("\n");

const html = [
  '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1">',
  '<title>Aura Fit — مراجعة وسائط التمارين</title>',
  '<style>',
  'body{margin:0;background:#0c1119;color:#eaf2f4;font:15px system-ui,sans-serif}',
  'main{max-width:1280px;margin:auto;padding:22px 18px 60px}',
  'h1{font-size:clamp(24px,4vw,34px);margin:4px 0 12px}h2{font-size:19px;margin:0 0 5px}',
  '.muted{color:#a9b6c4}.small{font-size:12px}.latin{color:#c6e867;text-align:right;margin:0 0 8px}',
  '.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.stat{background:#172431;padding:14px 18px;border-radius:15px}',
  '.stat strong{display:block;font-size:23px;color:#d7fb80}',
  '.notice{border:1px solid #c59c50;background:#322719;border-radius:15px;padding:15px;margin:14px 0}',
  '.filters{position:sticky;top:0;background:#0c1119e8;backdrop-filter:blur(10px);padding:12px 0;display:flex;gap:10px;z-index:5}',
  'input,select{box-sizing:border-box;background:#172431;border:1px solid #3b4b5a;border-radius:10px;color:#fff;padding:12px;font:inherit;min-width:0}',
  'input{flex:1}select{max-width:45%}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}',
  '.exercise{min-width:0;background:#17212d;border:1px solid #33424c;border-radius:20px;padding:18px}',
  '.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0;align-items:start}',
  '.comparison img{width:100%;max-height:260px;aspect-ratio:1;object-fit:contain;background:#101923;border-radius:12px}',
  '.candidate{border:1px dashed #d2a75a;border-radius:13px;padding:8px}',
  '.gif-preview{margin-top:12px}.preview-btn,.export-btn{border:1px solid #a6d54f;background:#26391f;color:#ecffcf;border-radius:10px;padding:10px 12px;cursor:pointer;font:inherit;font-size:12px;min-height:40px}',
  '.review-form{display:grid;gap:10px;border-top:1px solid #354451;padding-top:14px;margin-top:10px}',
  '.review-form label{display:grid;gap:6px;font-size:13px;color:#d7e5ed}',
  '.review-form textarea{resize:vertical;background:#101923;border:1px solid #43505b;border-radius:10px;color:white;font:inherit;padding:10px;width:100%;box-sizing:border-box}',
  '.review-form select{max-width:none;width:100%}',
  '.review-checks{border:1px solid #43505b;border-radius:10px;display:grid;gap:8px}',
  '.review-checks label{display:flex;align-items:center;gap:8px}.review-checks input{min-width:18px;width:18px;height:18px}',
  '.review-error{color:#ffbd8a;font-size:12px;margin:0;min-height:16px}',
  '.warn{color:#f0c372;font-size:12px;font-weight:bold;margin-bottom:8px}',
  '.links a{color:#cafa82}.code{font:12px monospace;direction:ltr;text-align:left;color:#859eb3}',
  '[hidden]{display:none!important}@media(max-width:700px){.grid{grid-template-columns:1fr}.filters{flex-wrap:wrap}.filters input{min-width:100%}}',
  '</style></head><body><main>',
  '<p class="muted">Aura Fit / مراجعة داخلية — مصدر مثبت بإصدار محدد</p>',
  '<h1>قائمة فحص مطابقة وسائط التمارين</h1>',
  '<div class="notice"><strong>قائمة تدقيق وليست مكتبة فيديوهات معتمدة.</strong>',
  '<p>لا تعتمد أي GIF قبل مقارنة الحركة والمعدات والعضلة واللقطات. ',
  'تعرض المنصة الإطارات الأصلية حتى تنتهي مراجعة المطابقة بصورة مؤكدة.</p></div>',
  '<section class="stats"><div class="stat"><strong>' + rows.length + '</strong>بانتظار وسائط معتمدة</div>',
  '<div class="stat"><strong>' + reviewed.length + '</strong>قيد المراجعة</div>',
  '<div class="stat"><strong>' + candidates.length + '</strong>مرشح محدد فقط</div>',
  '<div class="stat"><strong>' + missing.length + '</strong>دون مطابقة آمنة</div></section>',
  '<div class="filters"><input id="search" type="search" aria-label="البحث عن تمرين" placeholder="ابحث باسم التمرين أو المعدات…">',
  '<select id="filter" aria-label="تصفية قائمة المراجعة">',
  '<option value="all">جميع التمارين</option><option value="candidate">مرشح محدد</option>',
  '<option value="review">قيد المراجعة بلا مرشح</option><option value="none">دون مطابقة آمنة</option>',
  '<option value="pending">لم يُحدد لها قرار بعد</option>',
  '</select><button type="button" class="export-btn" id="import-csv">استيراد قرارات CSV</button>',
  '<input type="file" id="import-file" accept=".csv,text/csv" hidden aria-label="اختيار ملف مراجعة CSV">',
  '<button type="button" class="export-btn" id="export-csv">تصدير قرارات المراجعة CSV</button></div>',
  '<p class="muted" id="review-progress" aria-live="polite"></p>',
  '<p class="muted" id="import-result" role="status" aria-live="polite"></p>',
  '<p id="visible-count" class="muted" aria-live="polite"></p>',
  '<div class="grid">' + entries + '</div>',
  '<script>',
  // Embed the EXACT pure helpers used by CI; no network dependency/file://
  // import is necessary, and imported CSV never executes formulas or HTML.
  encodeReviewCsvCell.toString(),
  parseReviewCsv.toString(),
  validateImportedReviewCsv.toString(),
  buildReviewCsv.toString(),
  'const items=[...document.querySelectorAll(".exercise")];',
  'const exportColumns=' + jsLiteral(columns) + ';',
  'const exportRows=' + jsLiteral(csvRows) + ';',
  'const storageKey=' + jsLiteral(reviewKey) + ';',
  'const legacyKey=' + jsLiteral(legacyReviewKey) + ';',
  'let decisions=Object.create(null);',
  'try{const modern=localStorage.getItem(storageKey);',
  'const stored=JSON.parse(modern||localStorage.getItem(legacyKey)||"{}");',
  'if(stored&&typeof stored==="object"&&!Array.isArray(stored)){',
  'for(const item of items){const d=stored[item.dataset.slug];',
  'if(d&&typeof d==="object"){',
  'const safeDecision=d.decision==="recommended"&&',
  '(!d.checks||!Object.values(d.checks).every(Boolean))?',
  '"needs-evidence":d.decision;',
  'decisions[item.dataset.slug]={...d,decision:safeDecision};}}}}catch{}',
  'const checkNames=["movement","equipment","muscle","frames"];',
  'const search=document.getElementById("search"),filter=document.getElementById("filter");',
  'const importResult=document.getElementById("import-result");',
  'function showDecision(item){const saved=decisions[item.dataset.slug]||{};',
  'const selector=item.querySelector("[data-decision]");',
  'selector.value=[...selector.options].some(x=>x.value===saved.decision)?saved.decision:"";',
  'item.querySelector("[data-notes]").value=String(saved.notes||"").slice(0,1200);',
  'for(const name of checkNames){item.querySelector("[data-review-check="+name+"]").checked=Boolean(saved.checks&&saved.checks[name]);}',
  'item.querySelector("[data-review-error]").textContent="";}',
  'function saveDecision(item){const slug=item.dataset.slug;',
  'const selector=item.querySelector("[data-decision]");',
  'const notes=item.querySelector("[data-notes]").value.slice(0,1200);',
  'const checks=Object.fromEntries(checkNames.map(name=>',
  '[name,item.querySelector("[data-review-check="+name+"]").checked]));',
  'const error=item.querySelector("[data-review-error]");',
  'if(selector.value==="recommended"&&',
  '(checkNames.some(name=>!checks[name])||notes.trim().length<20)){',
  'selector.value="needs-evidence";',
  'error.textContent="لم يُقبل الترشيح: يجب إكمال الفحوص الأربعة وذكر سبب من 20 حرفًا على الأقل.";',
  '}else{error.textContent="";}',
  'decisions[slug]={decision:selector.value,notes,checks};',
  'try{localStorage.setItem(storageKey,JSON.stringify(decisions));}catch{}',
  'refresh();}',
  'for(const item of items){',
  'showDecision(item);',
  'item.querySelector("[data-decision]").addEventListener("change",()=>saveDecision(item));',
  'item.querySelector("[data-notes]").addEventListener("input",()=>saveDecision(item));',
  'for(const input of item.querySelectorAll("[data-review-check]")){input.addEventListener("change",()=>saveDecision(item));}',
  'const button=item.querySelector("[data-preview-control]");',
  'if(button){button.addEventListener("click",()=>{',
  'const img=item.querySelector("[data-preview-img]");',
  'if(img.hidden){img.src=button.dataset.src;img.hidden=false;',
  'button.textContent="⏹ إيقاف معاينة المرشح";',
  'button.setAttribute("aria-label","إيقاف معاينة المرشح غير المعتمد");}',
  'else{img.hidden=true;img.removeAttribute("src");',
  'button.textContent="▶ عرض الحركة المرشحة (غير معتمدة)";',
  'button.setAttribute("aria-label","تشغيل معاينة المرشح غير المعتمد");}',
  '});}',
  '}',
  'function refresh(){const query=search.value.trim().toLowerCase(),mode=filter.value;',
  'let shown=0,completed=0,recommended=0;',
  'for(const item of items){const choice=(decisions[item.dataset.slug]||{}).decision;',
  'if(choice)completed++;if(choice==="recommended")recommended++;',
  'const match=(!query||item.dataset.search.includes(query))&&',
  '(mode==="all"||(mode==="candidate"&&item.dataset.candidate==="yes")||',
  '(mode==="review"&&item.dataset.status==="review"&&item.dataset.candidate==="no")||',
  '(mode==="none"&&item.dataset.status==="none")||',
  '(mode==="pending"&&!choice));',
  'item.hidden=!match;if(match)shown++;}',
  'document.getElementById("visible-count").textContent="المعروض: "+shown+" من "+items.length;',
  'document.getElementById("review-progress").textContent=',
  '"قرارات مسجلة: "+completed+" / "+items.length+" · مرشحات موثقة (غير معتمدة): "+recommended;',
  '}',
  'search.addEventListener("input",refresh);filter.addEventListener("change",refresh);',
  'document.getElementById("import-csv").addEventListener("click",()=>document.getElementById("import-file").click());',
  'document.getElementById("import-file").addEventListener("change",async event=>{',
  'const input=event.currentTarget,file=input.files&&input.files[0];',
  'if(!file)return;',
  'try{if(file.size>1024*1024)throw new Error("ملف المراجعة أكبر من 1 ميجابايت.");',
  'const imported=validateImportedReviewCsv(await file.text(),exportColumns,exportRows);',
  'decisions=Object.assign(Object.create(null),decisions,imported);',
  'for(const item of items)showDecision(item);',
  'try{localStorage.setItem(storageKey,JSON.stringify(decisions));}catch{}',
  'refresh();importResult.textContent="تم استيراد "+Object.keys(imported).length+" قرارًا/مسودة، دون تفعيل أي GIF.";',
  '}catch(err){importResult.textContent="فشل الاستيراد: "+(err instanceof Error?err.message:"ملف غير صالح");}',
  'finally{input.value="";}',
  '});',
  'document.getElementById("export-csv").addEventListener("click",()=>{',
  'try{const text=buildReviewCsv(exportColumns,exportRows,decisions);',
  'const blob=new Blob([text],{type:"text/csv;charset=utf-8"});',
  'const href=URL.createObjectURL(blob),a=document.createElement("a");',
  'a.href=href;a.download="aura-fit-reviewed-media.csv";document.body.appendChild(a);',
  'a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);',
  'importResult.textContent="تم تصدير المراجعة مع الفحوص الأربعة وإصدار المصدر.";',
  '}catch(err){importResult.textContent="تعذر التصدير: "+(err instanceof Error?err.message:"راجع القرارات غير المكتملة");}',
  '});refresh();',
  '</script></main></body></html>',
].join("\n");

assert(html.includes("مرشح غير معتمد") && html.includes("data-candidate") &&
  html.includes("data-preview-control") && html.includes("export-csv") &&
  html.includes("data-decision") && html.includes("data-notes") &&
  html.includes("import-csv") && html.includes("data-review-check"),
  "audit page must expose human-review controls and mark all candidates as unapproved");
assert((html.match(/data-preview-control data-src=/g) ?? []).length === candidates.length,
  "GIF previews must be present only for reviewed candidates, not unrelated exercises");
const embeddedScript = html.split("<script>")[1]?.split("</script>")[0];
assert(embeddedScript, "generated review page is missing JavaScript interactions");
new Script(embeddedScript, { filename: "aura-fit-media-review-inline.js" });
if (!process.argv.includes("--check")) {
  const out = path.join(root, "media-review-output");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "index.html"), html, "utf8");
  fs.writeFileSync(path.join(out, "review-queue.csv"), csvText, "utf8");
  console.log("Review files: media-review-output/index.html and review-queue.csv");
}
console.log("Media review audit PASS: " + rows.length + " outstanding, " +
  candidates.length + " pinned candidates, " + reviewed.length + " review, " +
  missing.length + " none. No media was promoted.");
