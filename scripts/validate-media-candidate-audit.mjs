// Phase 44: permanent evidence ledger for conservative media decisions.
// Auditing a poster/title is NOT equivalent to validating the whole GIF motion.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const load=filename=>JSON.parse(fs.readFileSync(path.join(root,"src/data",filename),"utf8"));
const media=load("exercise-media-map.json");
const report=load("exercise-media-match-report.json");
const posters=load("media-review-candidate-posters.json");
const evidence=load("media-candidate-audit.json");
const manifest=load("workout-guide-manifest.json");
const fail=(reason)=>{throw new Error("Candidate media audit FAILED: "+reason)};
const check=(value,reason)=>{if(!value)fail(reason)};
const slugSet=new Set(manifest.map(entry=>entry.slug));
const active=new Set(Object.values(media).filter(entry=>
  entry?.matchConfidence==="exact"||entry?.matchConfidence==="high")
  .map(entry=>entry.sourceExerciseId));
const statuses=new Set(["rejected","needs-motion-review"]);
check(evidence.sourceRepository===report.sourceRepository,"different source repository");
check(evidence.sourceCommit===report.sourceCommit,"different pinned source commit");
check(evidence.evidenceScope.includes("NOT"),"the audit must not assert completed motion review");
check(evidence.reviews.length===3,"original three candidate decisions must be preserved");
const slugs=new Set(),ids=new Set();let rejected=0,pending=0;
for(const entry of evidence.reviews){
  check(slugSet.has(entry.slug),"unrecognized exercise "+entry.slug);
  check(!slugs.has(entry.slug),"duplicate exercise "+entry.slug);
  check(!ids.has(entry.sourceExerciseId),"duplicate source ID "+entry.sourceExerciseId);
  slugs.add(entry.slug);ids.add(entry.sourceExerciseId);
  check(statuses.has(entry.result),"unsafe/unknown candidate decision "+entry.slug);
  check(entry.motionFullyReviewed===false,"poster/title audit cannot claim full GIF review");
  check(entry.evidence==="title-and-static-poster","unsupported evidence level");
  check(typeof entry.reasonAr==="string"&&entry.reasonAr.length>=60,
    "candidate rejection/hold requires an explicit explanation");
  check(/^[0-9a-f]{40}$/.test(entry.posterBlobSha)&&/^[0-9a-f]{40}$/.test(entry.gifBlobSha),
    "pinned source media blob SHA missing for "+entry.slug);
  check(entry.poster.startsWith("images/"+entry.sourceExerciseId+"-"),
    "poster ID mismatch");
  check(entry.gif===entry.poster.replace(/^images\//,"videos/").replace(/\.jpg$/,".gif"),
    "GIF/poster hash mismatch");
  check(!active.has(entry.sourceExerciseId),
    "unverified or rejected source GIF was activated");
  const map=media[entry.slug];
  check(map?.matchConfidence==="review","audit target must remain in review and use frame fallback");
  check(!map.gif&&!map.sourceExerciseId,
    "unverified source must not have an active GIF");
  if(entry.result==="rejected"){
    rejected++;
    check(!map.candidateSourceExerciseId&&!map.candidateSourceName,
      "rejected candidate left in active review queue: "+entry.slug);
    check(!posters[entry.sourceExerciseId],
      "rejected candidate poster still listed as plausible: "+entry.slug);
  }else{
    pending++;
    check(map.candidateSourceExerciseId===entry.sourceExerciseId&&
      map.candidateSourceName===entry.sourceName,
      "motion-review candidate metadata changed: "+entry.slug);
    check(posters[entry.sourceExerciseId]===entry.poster,
      "missing poster for the remaining candidate");
  }
}
const activeCandidateCount=Object.entries(media).filter(([slug,entry])=>
  slug!=="_meta"&&entry?.matchConfidence==="review"&&
  entry.candidateSourceExerciseId).length;
check(rejected===2&&pending===1,"triage decisions diverged from reviewed source");
check(Object.keys(posters).length===pending,"poster queue contains stale entries");
check(activeCandidateCount===pending&&report.candidateQueueAudit.remainingReviewCandidates===pending,
  "match report and actual review queue mismatch");
const triage=report.candidateQueueAudit.posterTriage;
check(triage?.checked===3&&triage.rejected===rejected&&
  triage.motionReviewPending===pending&&triage.fullGifMotionCertified===0,
  "candidate review coverage misreported");
check(report.activePreferredMedia===191&&report.exact===79&&report.high===112,
  "the triage must not promote any GIF to active status");
console.log("Media candidate triage PASS: 3 pinned posters/titles assessed; 2 unsafe proposals removed; 1 awaiting complete GIF motion verification; 191 active GIFs unchanged.");
