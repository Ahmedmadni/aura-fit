import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workoutPath = path.join(root, "src", "routes", "workout.tsx");
const profilePath = path.join(root, "src", "lib", "user-profile.ts");
const enginePath = path.join(root, "src", "lib", "workout-engine.ts");

const fail = (message) => {
  console.error("Workout session integrity FAILED: " + message);
  process.exit(1);
};

const workout = fs.readFileSync(workoutPath, "utf8");
const profile = fs.readFileSync(profilePath, "utf8");
const engine = fs.readFileSync(enginePath, "utf8");

const skipMatch = workout.match(
  /function skipCurrentExercise\(\) \{([\s\S]*?)\n  \}\n\n/,
);
if (!skipMatch) fail("skipCurrentExercise helper is missing");

const skipBody = skipMatch[1];
for (const required of [
  "setSkipped((items) => new Set(items).add(currentId))",
  "setCompleted((items) => {",
  "nextItems.delete(currentId)",
]) {
  if (!skipBody.includes(required)) {
    fail("skip helper is missing required state transition: " + required);
  }
}

for (const banned of [
  "saveCurrentSet()",
  "new Set(s).add(current.exercise.id)",
  "new Set(items).add(current.exercise.id)",
]) {
  if (skipBody.includes(banned)) {
    fail("skip helper incorrectly records completion data: " + banned);
  }
}

for (const required of [
  "skipped: skipped.has(p.exercise.id)",
  "completed: completed.has(p.exercise.id)",
  "setSkipped((items) => {",
  "const completedActiveSec = useMemo(",
  "const completedCalories = useMemo(",
  "durationSec: finishedDurationSec",
  "activeSec: completedActiveSec",
  "calories: completedCalories",
  'StatCard label="السعرات" value={`~${completedCalories}`}',
]) {
  if (!workout.includes(required)) {
    fail("workout history/session marker missing: " + required);
  }
}

for (const banned of [
  'value={`~${minutes * 8}`}',
  "const durationSec = Math.round((Date.now() - startedAt.current) / 1000);",
]) {
  if (workout.includes(banned)) {
    fail("completion summary/history drift pattern returned: " + banned);
  }
}

if (!profile.includes("skipped?: boolean;")) {
  fail("CompletedWorkout schema does not preserve explicit skip provenance");
}

for (const required of [
  "item.id === exerciseId && item.completed",
  "if (!exercise.completed) continue;",
]) {
  if (!profile.includes(required) && !engine.includes(required)) {
    fail("completed-only analytics guard missing: " + required);
  }
}

console.log(
  "Workout session integrity PASS: manual skips stay incomplete, preserve skip provenance, and incomplete attempts are excluded from progression analytics.",
);
