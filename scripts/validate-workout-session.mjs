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
  "const runningBeforeSwap = useRef(true);",
  "runningBeforeSwap.current = running;",
  "setRunning(restoreRunning);",
  'drag={showSwapOptions || showExitConfirm ? false : "x"}',
  "const runningBeforeExit = useRef(true);",
  "function requestExit() {",
  "function cancelExit() {",
  "function confirmExitWithoutSaving() {",
  'role="dialog"',
  'aria-labelledby="workout-exit-title"',
  "loadWorkoutSessionDraft({",
  "saveWorkoutSessionDraft(draftSnapshot.current)",
  "clearWorkoutSessionDraft();",
  "setRestoredDraft(true)",
  "window.setInterval(flushDraft, 5000)",
  'window.addEventListener("pagehide", flushDraft)',
  "loadRecoverableWorkoutSessionDraft()",
  "setSessionConflict(recoverable)",
  "function resumeConflictingSession() {",
  "function replaceConflictingSession() {",
  "initializeFreshSession(true)",
  "لديك جلسة محفوظة بالفعل",
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

const applySwapMatch = workout.match(
  /function applyManualSwap\(replacementId: string\) \{([\s\S]*?)\n  \}\n\n/,
);
if (!applySwapMatch) fail("applyManualSwap helper is missing");
if (applySwapMatch[1].includes("setRunning(true)")) {
  fail("manual swap must restore the pre-swap timer state, not force resume");
}
if (!applySwapMatch[1].includes("runningBeforeSwap.current")) {
  fail("manual swap does not read the pre-swap timer state");
}

const exitMatch = workout.match(
  /function requestExit\(\) \{([\s\S]*?)\n  \}\n\n/,
);
if (!exitMatch) fail("requestExit helper is missing");
if (!exitMatch[1].includes("runningBeforeExit.current")) {
  fail("exit guard does not preserve the pre-exit timer state");
}
if (!workout.includes("onClick={requestExit}")) {
  fail("workout close button bypasses the exit guard");
}
if (workout.includes('onClick={() => navigate({ to: "/" })}')) {
  fail("unguarded direct workout exit returned");
}

const conflictRestoreMatch = workout.match(
  /function initializeFreshSession\(clearExistingDraft = false\) \{([\s\S]*?)\n  \}\n\n/,
);
if (!conflictRestoreMatch) fail("initializeFreshSession helper is missing");
if (!conflictRestoreMatch[1].includes("clearWorkoutSessionDraft()")) {
  fail("starting a replacement session does not explicitly clear the saved draft");
}
if (!workout.includes("workoutId: sessionIdentity.workoutId")) {
  fail("active-session persistence is still coupled to the current route workout ID");
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
