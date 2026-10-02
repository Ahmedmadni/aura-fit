import {
  generateWeeklyPlan,
  generateWeeklySchedule,
  getExerciseProgressionPrescription,
  getTrainingAdaptation,
  getWeeklyMuscleCoverage,
  getWeeklyVolumeStatus,
  MAJOR_MUSCLES,
} from "../src/lib/workout-engine";
import { type Equipment, type Goal } from "../src/lib/exercise-db";
import {
  DEFAULT_PROFILE,
  estimateOneRepMaxKg,
  exerciseStrengthSummaries,
  type CompletedWorkout,
  type UserProfile,
} from "../src/lib/user-profile";

const FULL_EQUIPMENT: Equipment[] = [
  "none",
  "mat",
  "dumbbells",
  "barbell",
  "kettlebell",
  "resistance-band",
  "pullup-bar",
  "bench",
  "machine",
  "cable",
  "cardio-machine",
  "weight-plate",
  "wall",
  "chair",
  "doorway",
  "towel",
  "box",
  "stability-ball",
];

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

function historyEntry(
  id: string,
  performance: number,
  exerciseId = "bench-press",
  setReps: number[] = [10, 10, 10],
  loadKg = 70,
  rir = 2,
): CompletedWorkout {
  return {
    id,
    date: new Date().toISOString(),
    exercises: [
      {
        id: exerciseId,
        sets: setReps.length,
        reps: "8-12",
        completed: true,
        setReps,
        setLoadsKg: setReps.map(() => loadKg),
        setRir: setReps.map(() => rir),
        setRpe: setReps.map(() => 10 - rir),
      },
    ],
    durationSec: 1800,
    activeSec: 1200,
    calories: 250,
    intensity: 70,
    performance,
  };
}

const strongProfile: UserProfile = {
  ...DEFAULT_PROFILE,
  level: "intermediate",
  sleepQuality: 5,
  fatigue: 1,
  equipment: FULL_EQUIPMENT,
  daysPerWeek: 4,
  sessionMinutes: 45,
};
const strongHistory = [
  historyEntry("strong-1", 94, "bench-press", [12, 12, 12]),
  historyEntry("strong-2", 91, "bench-press", [12, 12, 12]),
  historyEntry("strong-3", 90, "bench-press", [11, 12, 12]),
];
const progressAdaptation = getTrainingAdaptation(strongProfile, strongHistory);
if (progressAdaptation.mode !== "progress") {
  fail(`strong history should produce progress mode, got ${progressAdaptation.mode}`);
}

const loadPrescription = getExerciseProgressionPrescription(
  "bench-press",
  "8-12",
  strongHistory.slice(0, 2),
  "progress",
);
if (loadPrescription.action !== "increase-load") {
  fail(
    `two top-range sessions should request increase-load, got ${loadPrescription.action}`,
  );
}
if (loadPrescription.lastLoadKg !== 70 || loadPrescription.suggestedLoadKg !== 72.5) {
  fail(
    `70kg barbell progression should suggest 72.5kg, got last=${loadPrescription.lastLoadKg} next=${loadPrescription.suggestedLoadKg}`,
  );
}
if (loadPrescription.targetRir !== "2-3") {
  fail(`progress target RIR should be 2-3, got ${loadPrescription.targetRir}`);
}

const nearFailureHistory = [
  historyEntry("grind-1", 90, "bench-press", [12, 12, 12], 70, 0),
  historyEntry("grind-2", 90, "bench-press", [12, 12, 12], 70, 1),
];
const nearFailurePrescription = getExerciseProgressionPrescription(
  "bench-press",
  "8-12",
  nearFailureHistory,
  "progress",
);
if (nearFailurePrescription.action === "increase-load") {
  fail("near-failure top-range sets must not trigger an automatic load increase");
}

const e1rm = estimateOneRepMaxKg(70, 10, 2);
if (e1rm !== 98) {
  fail(`expected Epley-style 70x10@RIR2 e1RM=98kg, got ${e1rm}`);
}
const strengthSummary = exerciseStrengthSummaries(strongHistory).find(
  (item) => item.exerciseId === "bench-press",
);
if (!strengthSummary || strengthSummary.lastLoadKg !== 70) {
  fail("strength summary should retain the latest 70kg working load");
}
if (!strengthSummary || strengthSummary.bestEstimated1RmKg <= 70) {
  fail("strength summary should calculate an estimated 1RM above working load");
}

const poorProfile: UserProfile = {
  ...strongProfile,
  sleepQuality: 2,
  fatigue: 5,
};
const poorHistory = [
  historyEntry("poor-1", 58, "bench-press", [6, 6, 7]),
  historyEntry("poor-2", 62, "bench-press", [6, 7, 6]),
  historyEntry("poor-3", 60, "bench-press", [7, 6, 6]),
];
const recoveryAdaptation = getTrainingAdaptation(poorProfile, poorHistory);
if (recoveryAdaptation.mode !== "recovery") {
  fail(`poor recovery history should produce recovery mode, got ${recoveryAdaptation.mode}`);
}

const reducePrescription = getExerciseProgressionPrescription(
  "bench-press",
  "8-12",
  poorHistory.slice(0, 2),
  "recovery",
);
if (reducePrescription.action !== "reduce") {
  fail(
    `recovery prescription should request reduce, got ${reducePrescription.action}`,
  );
}
if (
  reducePrescription.suggestedLoadKg === undefined ||
  reducePrescription.suggestedLoadKg >= 70
) {
  fail(
    `recovery prescription should reduce a 70kg working load, got ${reducePrescription.suggestedLoadKg}`,
  );
}
if (reducePrescription.targetRir !== "3-4") {
  fail(`recovery target RIR should be 3-4, got ${reducePrescription.targetRir}`);
}

const progressPlan = generateWeeklyPlan(strongProfile, strongHistory);
if (!progressPlan.every((workout) => workout.adaptation.mode === "progress")) {
  fail("progress history was not propagated to every generated workout");
}
const recoveryPlan = generateWeeklyPlan(poorProfile, poorHistory);
if (!recoveryPlan.every((workout) => workout.adaptation.mode === "recovery")) {
  fail("recovery history was not propagated to every generated workout");
}
const progressStrengthSets = progressPlan
  .flatMap((workout) => workout.exercises)
  .filter((item) => ["main", "accessory", "core"].includes(item.phase))
  .reduce((sum, item) => sum + item.sets, 0);
const recoveryStrengthSets = recoveryPlan
  .flatMap((workout) => workout.exercises)
  .filter((item) => ["main", "accessory", "core"].includes(item.phase))
  .reduce((sum, item) => sum + item.sets, 0);
if (recoveryStrengthSets >= progressStrengthSets) {
  fail(
    `recovery volume should be lower than progress volume: ${recoveryStrengthSets} vs ${progressStrengthSets}`,
  );
}

console.log(
  `adaptive checks: progress readiness=${progressAdaptation.readinessScore}, recovery readiness=${recoveryAdaptation.readinessScore}, strength sets ${progressStrengthSets}->${recoveryStrengthSets}, load 70->${loadPrescription.suggestedLoadKg}kg, e1RM=${e1rm}kg`,
);

for (const daysPerWeek of [2, 3, 4, 5, 6]) {
  const goals: Goal[] = daysPerWeek >= 5 ? ["muscle-gain"] : ["general-fitness"];
  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    level: "intermediate",
    goals,
    equipment: FULL_EQUIPMENT,
    daysPerWeek,
    sessionMinutes: 45,
  };

  const plan = generateWeeklyPlan(profile);
  const schedule = generateWeeklySchedule(profile);
  if (schedule.length !== 7) {
    fail(`${daysPerWeek}d: weekly schedule must contain 7 calendar days`);
  }
  const scheduledTrainingDays = schedule.filter((day) => !day.isRest);
  if (scheduledTrainingDays.length !== daysPerWeek) {
    fail(
      `${daysPerWeek}d: expected ${daysPerWeek} scheduled training days, got ${scheduledTrainingDays.length}`,
    );
  }
  for (const day of scheduledTrainingDays) {
    if (day.workoutIndex === undefined || !day.workout) {
      fail(`${daysPerWeek}d: scheduled training day is missing its workout`);
    }
  }

  if (plan.length !== daysPerWeek) {
    fail(`${daysPerWeek}d: expected ${daysPerWeek} workouts, got ${plan.length}`);
  }

  plan.forEach((workout, index) => {
    const ids = workout.exercises.map((item) => item.exercise.id);
    if (new Set(ids).size !== ids.length) {
      fail(`${daysPerWeek}d day ${index + 1}: duplicate exercise inside session`);
    }
    if (!workout.exercises.some((item) => item.phase === "warmup")) {
      fail(`${daysPerWeek}d day ${index + 1}: no warm-up`);
    }
    if (!workout.exercises.some((item) => item.phase === "main")) {
      fail(`${daysPerWeek}d day ${index + 1}: no main exercise`);
    }
    if (!workout.exercises.some((item) => item.phase === "cooldown")) {
      fail(`${daysPerWeek}d day ${index + 1}: no cooldown`);
    }

    const phases = workout.exercises.map((item) => item.phase);
    const firstMain = phases.indexOf("main");
    const lastWarmup = phases.lastIndexOf("warmup");
    const firstCooldown = phases.indexOf("cooldown");
    if (firstMain !== -1 && lastWarmup > firstMain) {
      fail(`${daysPerWeek}d day ${index + 1}: warm-up appears after main work`);
    }
    if (
      firstCooldown !== -1 &&
      phases.slice(firstCooldown + 1).some((phase) => phase !== "cooldown")
    ) {
      fail(`${daysPerWeek}d day ${index + 1}: work appears after cooldown starts`);
    }
  });

  const volume = getWeeklyVolumeStatus(plan, profile);
  for (const item of volume) {
    if (item.status === "low") {
      fail(
        `${daysPerWeek}d: ${item.muscle} effective volume ${item.effectiveSets} is below minimum ${item.min}`,
      );
    }
    if (item.status === "high") {
      fail(
        `${daysPerWeek}d: ${item.muscle} effective volume ${item.effectiveSets} exceeds maximum ${item.max}`,
      );
    }
  }

  const coverage = getWeeklyMuscleCoverage(plan);
  for (const muscle of MAJOR_MUSCLES) {
    const item = coverage.find((entry) => entry.muscle === muscle);
    if (!item || item.days < 2) {
      fail(`${daysPerWeek}d: ${muscle} covered on only ${item?.days ?? 0} day(s)`);
    }
  }

  console.log(
    `${daysPerWeek} days: ` +
      coverage
        .filter((item) => MAJOR_MUSCLES.includes(item.muscle))
        .map((item) => `${item.muscle}=${item.days}x`)
        .join(", ") +
      " | volume " +
      volume.map((item) => `${item.muscle}=${item.effectiveSets}/${item.min}-${item.max}`).join(", "),
  );
}

if (failures.length) {
  console.error("\nWorkout programming quality gate FAILED:\n");
  failures.forEach((message) => console.error("- " + message));
  process.exit(1);
}

console.log("\nWorkout programming quality gate PASS.");
