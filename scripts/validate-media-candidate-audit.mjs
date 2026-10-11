// Pinned evidence audit for conservative GIF mapping decisions. The Hindu
// candidate was visually sampled frame-by-frame, but is NOT a verified
// equivalent of the canonical Hindu push-up motion.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = filename => JSON.parse(
  fs.readFileSync(path.join(root, "src/data", filename), "utf8")
);
const media = load("exercise-media-map.json");
const report = load("exercise-media-match-report.json");
const posters = load("media-review-candidate-posters.json");
const evidence = load("media-candidate-audit.json");
const manifest = load("workout-guide-manifest.json");
const fail = reason => { throw new Error("Candidate media audit FAILED: " + reason); };
const check = (ok, reason) => { if (!ok) fail(reason); };
const slugs = new Set(manifest.map(entry => entry.slug));
const active = new Set(Object.values(media).filter(entry =>
  ["exact", "high"].includes(entry?.matchConfidence)
).map(entry => entry.sourceExerciseId));

check(evidence.sourceRepository === report.sourceRepository, "source repository differs");
check(evidence.sourceCommit === report.sourceCommit, "source commit differs");
check(evidence.reviews.length === 3, "all three historical proposals must retain evidence");
const ids = new Set(), reviewedSlugs = new Set();
let rejected = 0, pending = 0, motionInspected = 0;
for (const entry of evidence.reviews) {
  check(slugs.has(entry.slug), "unknown exercise " + entry.slug);
  check(!ids.has(entry.sourceExerciseId) && !reviewedSlugs.has(entry.slug),
    "duplicate candidate ID / exercise slug");
  ids.add(entry.sourceExerciseId);
  reviewedSlugs.add(entry.slug);
  check(["rejected", "needs-motion-review"].includes(entry.result),
    "candidate review may never auto-approve a GIF");
  check(typeof entry.reasonAr === "string" && entry.reasonAr.length >= 60,
    "reviewer must preserve a concrete source-based explanation");
  check(/^[0-9a-f]{40}$/.test(entry.posterBlobSha) &&
    /^[0-9a-f]{40}$/.test(entry.gifBlobSha), "pinned Git blob identifiers missing");
  check(entry.poster.startsWith("images/" + entry.sourceExerciseId + "-"),
    "poster/source ID mismatch");
  check(entry.gif === entry.poster.replace(/^images\//, "videos/").replace(/\.jpg$/, ".gif"),
    "GIF and poster must share one source hash");
  check(!active.has(entry.sourceExerciseId),
    "rejected/unverified source ID activated elsewhere");
  const map = media[entry.slug];
  check(map?.matchConfidence === "review" && !map.gif && !map.sourceExerciseId,
    "audited exercise must retain original frame fallback");

  if (entry.motionFullyReviewed) {
    motionInspected++;
    check(entry.slug === "hindu-push-up" &&
      entry.evidence === "decoded-full-gif-18-frame-audit",
      "only source 3217 has decoded full-motion evidence");
    const frames = entry.motionAudit;
    check(frames?.frames === 18 && frames.durationMs === 4500 &&
      JSON.stringify(frames.resolution) === "[180,180]" &&
      JSON.stringify(frames.frameIndexesInspected) === JSON.stringify(Array.from({length:18},(_,i)=>i)),
      "motion-audit frame count, duration or full frame index coverage has changed");
    check(frames.phases.length === 4 &&
      frames.phases.every(p => typeof p.observationAr === "string" && p.observationAr.length > 25) &&
      frames.mismatchAr.length > 50 && frames.limitation.length > 50,
      "complete GIF-motion audit needs observed phases, mismatch, and limits");
  } else {
    check(entry.evidence === "title-and-static-poster" && !entry.motionAudit,
      "poster/title findings must not be described as full-motion review");
  }
  if (entry.result === "rejected") {
    rejected++;
    check(!map.candidateSourceExerciseId && !map.candidateSourceName,
      "rejected candidate left in proposed media mapping: " + entry.slug);
    check(!posters[entry.sourceExerciseId],
      "rejected candidate poster left in proposal queue: " + entry.slug);
  } else {
    pending++;
    check(map.candidateSourceExerciseId === entry.sourceExerciseId &&
      map.candidateSourceName === entry.sourceName,
      "pending motion-review candidate metadata changed");
    check(posters[entry.sourceExerciseId] === entry.poster,
      "pending candidate poster is absent");
  }
}
const candidateCount = Object.entries(media).filter(([slug,entry]) =>
  slug !== "_meta" && entry?.matchConfidence === "review" &&
  entry.candidateSourceExerciseId).length;
check(rejected === 3 && pending === 0 && motionInspected === 1,
  "full GIF review must close the three-proposal queue");
check(Object.keys(posters).length === 0 && candidateCount === 0,
  "retired media candidate references remain");
check(report.candidateQueueAudit.remainingReviewCandidates === 0,
  "match report still lists an active proposal");
const triage = report.candidateQueueAudit.posterTriage;
check(triage?.checked === 3 && triage.rejected === 3 &&
  triage.motionReviewPending === 0 && triage.fullGifMotionInspected === 1 &&
  triage.fullGifMotionCertified === 0,
  "review report does not distinguish inspection from approval");
check(report.activePreferredMedia === 191 && report.exact === 79 &&
  report.high === 112 && report.review === 71 && report.none === 40,
  "a rejected proposal must not change exercise catalog coverage");
console.log(
  "Media candidate triage PASS: 3/3 unsafe or non-equivalent suggestions rejected; " +
  "source 3217 full 18-frame inspection documented; 191 approved GIFs unchanged."
);
