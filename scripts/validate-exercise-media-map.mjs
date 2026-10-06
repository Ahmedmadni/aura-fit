import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));

const manifest = readJson("src/data/workout-guide-manifest.json");
const mediaMap = readJson("src/data/exercise-media-map.json");
const report = readJson("src/data/exercise-media-match-report.json");

const VALID_CONFIDENCE = new Set(["exact", "high", "review", "none"]);
const ACTIVE_CONFIDENCE = new Set(["exact", "high"]);
const failures = [];
const fail = (message) => failures.push(message);

if (!Array.isArray(manifest)) fail("workout-guide-manifest.json must be an array.");

const manifestSlugs = new Set(manifest.map((exercise) => exercise.slug));
const mapEntries = Object.entries(mediaMap).filter(([slug]) => slug !== "_meta");
const mapSlugs = new Set(mapEntries.map(([slug]) => slug));

if (manifestSlugs.size !== manifest.length) fail("Exercise manifest contains duplicate slugs.");
if (mapSlugs.size !== mapEntries.length) fail("Exercise media map contains duplicate slugs.");
if (manifest.length !== mapEntries.length) {
  fail(`Manifest/media-map size mismatch: ${manifest.length} vs ${mapEntries.length}.`);
}

for (const slug of manifestSlugs) {
  if (!mapSlugs.has(slug)) fail(`Missing media-map entry for ${slug}.`);
}
for (const slug of mapSlugs) {
  if (!manifestSlugs.has(slug)) fail(`Media-map entry has no manifest exercise: ${slug}.`);
}

for (const exercise of manifest) {
  if (!Array.isArray(exercise.frames) || exercise.frames.length !== 3) {
    fail(`${exercise.slug}: fallback must contain exactly 3 Workout Guide frames.`);
    continue;
  }
  const indexes = exercise.frames.map((frame) => frame.index).sort();
  if (indexes.join(",") !== "1,2,3") {
    fail(`${exercise.slug}: fallback frame indexes must be exactly 1,2,3.`);
  }
}

const counts = { exact: 0, high: 0, review: 0, none: 0 };
const activeSourceIds = new Map();

for (const [slug, entry] of mapEntries) {
  if (!VALID_CONFIDENCE.has(entry.matchConfidence)) {
    fail(`${slug}: invalid matchConfidence "${entry.matchConfidence}".`);
    continue;
  }
  counts[entry.matchConfidence] += 1;

  const active = ACTIVE_CONFIDENCE.has(entry.matchConfidence);
  if (active) {
    if (entry.source !== "hasaneyldrm/exercises-dataset") {
      fail(`${slug}: active preferred media must use hasaneyldrm/exercises-dataset.`);
    }
    if (!entry.sourceExerciseId) fail(`${slug}: active mapping is missing sourceExerciseId.`);
    if (!entry.sourceName) fail(`${slug}: active mapping is missing sourceName.`);
    if (!entry.gif || !entry.gif.endsWith(".gif")) fail(`${slug}: active mapping is missing a GIF path.`);
    if (!entry.poster || !/\.(jpg|jpeg|png|webp)$/i.test(entry.poster)) {
      fail(`${slug}: active mapping is missing a static poster path.`);
    }
    if (entry.sourceExerciseId) {
      const other = activeSourceIds.get(entry.sourceExerciseId);
      if (other) {
        fail(`Duplicate active sourceExerciseId ${entry.sourceExerciseId}: ${other} and ${slug}.`);
      } else {
        activeSourceIds.set(entry.sourceExerciseId, slug);
      }
    }
  } else {
    for (const field of ["source", "sourceExerciseId", "gif", "poster"]) {
      if (entry[field]) fail(`${slug}: ${entry.matchConfidence} entries must not activate field "${field}".`);
    }
  }
}

let candidateSourceIdCollisions = 0;
let reviewCandidateCount = 0;

for (const [slug, entry] of mapEntries) {
  const hasCandidateId = Boolean(entry.candidateSourceExerciseId);
  const hasCandidateName = Boolean(entry.candidateSourceName);

  if (hasCandidateId !== hasCandidateName) {
    fail(
      `${slug}: candidateSourceExerciseId and candidateSourceName must be provided together.`,
    );
  }

  if (entry.matchConfidence === "none" && (hasCandidateId || hasCandidateName)) {
    fail(`${slug}: none entries must not carry review-candidate metadata.`);
  }

  if (entry.matchConfidence === "review" && entry.candidateSourceExerciseId) {
    reviewCandidateCount += 1;
    const activeOwner = activeSourceIds.get(entry.candidateSourceExerciseId);
    if (activeOwner && activeOwner !== slug) {
      candidateSourceIdCollisions += 1;
      fail(
        `${slug}: review candidate sourceExerciseId ${entry.candidateSourceExerciseId} is already active for ${activeOwner}.`,
      );
    }
  }
}

if (
  report.candidateQueueAudit?.activeSourceIdCollisions !==
  candidateSourceIdCollisions
) {
  fail(
    `Match report candidateQueueAudit.activeSourceIdCollisions=${report.candidateQueueAudit?.activeSourceIdCollisions} but media map requires ${candidateSourceIdCollisions}.`,
  );
}

if (
  report.candidateQueueAudit?.remainingReviewCandidates !== reviewCandidateCount
) {
  fail(
    `Match report candidateQueueAudit.remainingReviewCandidates=${report.candidateQueueAudit?.remainingReviewCandidates} but media map contains ${reviewCandidateCount} review candidates.`,
  );
}

const activePreferredMedia = counts.exact + counts.high;
const reportChecks = {
  auraExerciseCount: manifest.length,
  exact: counts.exact,
  high: counts.high,
  review: counts.review,
  none: counts.none,
  activePreferredMedia,
};

for (const [field, expected] of Object.entries(reportChecks)) {
  if (report[field] !== expected) {
    fail(`Match report ${field}=${report[field]} but media map requires ${expected}.`);
  }
}

if (mediaMap._meta?.auraExerciseCount !== manifest.length) {
  fail("Media-map metadata auraExerciseCount does not match the manifest.");
}
if (mediaMap._meta?.sourceCommit !== report.sourceCommit) {
  fail("Media-map/report source commits do not match.");
}
if (mediaMap._meta?.generatedFrom !== report.sourceExerciseCount) {
  fail("Media-map generatedFrom does not match report sourceExerciseCount.");
}

if (failures.length) {
  console.error("\nExercise media quality gate FAILED:\n");
  for (const message of failures) console.error("- " + message);
  process.exit(1);
}

console.log(
  `Exercise media quality gate PASS — ${manifest.length} exercises; ` +
    `${counts.exact} exact, ${counts.high} high, ${counts.review} review, ` +
    `${counts.none} none; ${activePreferredMedia} preferred GIFs.`,
);
