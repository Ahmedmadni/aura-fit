import { DEFAULT_PROFILE } from "../src/lib/user-profile";
import { generateWorkout } from "../src/lib/workout-engine";
import {
  WORKOUT_SESSION_MAX_AGE_MS,
  parseWorkoutSessionDraft,
} from "../src/lib/workout-session";
import { parseWorkoutSessionMeta } from "../src/lib/workout-session-meta";

const fail = (message: string) => {
  console.error("Workout recovery validation FAILED: " + message);
  process.exit(1);
};

const now = Date.now();
const workout = generateWorkout(DEFAULT_PROFILE, {
  day: 0,
  history: [],
});
if (!workout.exercises.length) fail("generated workout has no exercises");

const base = {
  version: 1,
  workoutId: workout.id,
  day: 0,
  savedAt: new Date(now - 60_000).toISOString(),
  plan: workout.exercises,
  index: 0,
  setIdx: 1,
  phase: "work",
  remaining: workout.exercises[0].workSeconds,
  completed: [] as string[],
  skipped: [] as string[],
  setReps: {} as Record<string, number[]>,
  setLoadsKg: {} as Record<string, number[]>,
  setRir: {} as Record<string, number[]>,
  currentReps: 8,
  currentLoadKg: 0,
  currentRir: null as number | null,
  elapsed: 125,
  muted: false,
};

const parsed = parseWorkoutSessionDraft(base, now);
if (!parsed) fail("valid active session draft was rejected");
if (parsed.workoutId !== workout.id || parsed.elapsed !== 125) {
  fail("valid draft fields were not preserved");
}

const stalePlan = JSON.parse(JSON.stringify(base));
stalePlan.plan[0].exercise.name = "STALE EXERCISE NAME";
const refreshed = parseWorkoutSessionDraft(stalePlan, now);
if (!refreshed) fail("draft with stale exercise metadata was rejected");
if (refreshed.plan[0].exercise.name === "STALE EXERCISE NAME") {
  fail("recovery did not refresh exercise metadata from the live database");
}

const expired = {
  ...base,
  savedAt: new Date(now - WORKOUT_SESSION_MAX_AGE_MS - 1).toISOString(),
};
if (parseWorkoutSessionDraft(expired, now) !== null) {
  fail("expired workout session draft was accepted");
}

const wrongVersion = { ...base, version: 99 };
if (parseWorkoutSessionDraft(wrongVersion, now) !== null) {
  fail("unknown workout session version was accepted");
}

const unknownExercise = JSON.parse(JSON.stringify(base));
unknownExercise.plan[0].exercise.id = "__missing_exercise__";
if (parseWorkoutSessionDraft(unknownExercise, now) !== null) {
  fail("draft with unknown exercise ID was accepted");
}

const invalidProgress = {
  ...base,
  completed: ["__not_in_plan__"],
};
if (parseWorkoutSessionDraft(invalidProgress, now) !== null) {
  fail("draft with completion ID outside the plan was accepted");
}

const invalidIndex = {
  ...base,
  index: workout.exercises.length + 10,
};
if (parseWorkoutSessionDraft(invalidIndex, now) !== null) {
  fail("draft with invalid exercise index was accepted");
}

const metaBase = {
  version: 1,
  workoutId: workout.id,
  day: 0,
  savedAt: new Date(now - 60_000).toISOString(),
  index: 0,
  setIdx: 1,
  total: workout.exercises.length,
  currentExerciseName: workout.exercises[0].exercise.name,
};

const parsedMeta = parseWorkoutSessionMeta(metaBase, now);
if (
  !parsedMeta ||
  parsedMeta.workoutId !== workout.id ||
  parsedMeta.currentExerciseName !== workout.exercises[0].exercise.name
) {
  fail("valid lightweight workout-session metadata was rejected");
}

const expiredMeta = {
  ...metaBase,
  savedAt: new Date(now - WORKOUT_SESSION_MAX_AGE_MS - 1).toISOString(),
};
if (parseWorkoutSessionMeta(expiredMeta, now) !== null) {
  fail("expired lightweight workout-session metadata was accepted");
}

const invalidMetaIndex = {
  ...metaBase,
  index: workout.exercises.length,
};
if (parseWorkoutSessionMeta(invalidMetaIndex, now) !== null) {
  fail("lightweight metadata accepted an out-of-range exercise index");
}

console.log(
  "Workout recovery PASS: full drafts and lightweight navigation metadata validate expiry, bounds and current exercise state.",
);
