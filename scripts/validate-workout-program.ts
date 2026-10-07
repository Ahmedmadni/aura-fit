import {
  createManualExerciseSwap,
  generateMonthlyProgram,
  generateWeeklyPlan,
  generateWeeklySchedule,
  getExerciseProgressionPrescription,
  getManualExerciseSwapOptions,
  getWeeklyRecoverySpacing,
  getWeeklyMovementBalance,
  getExerciseRotationDecision,
  getPeriodizationPlan,
  getTrainingAdaptation,
  getWeeklyMuscleCoverage,
  isSafeFor,
  getWeeklyVolumeStatus,
  MAJOR_MUSCLES,
} from "../src/lib/workout-engine";
import {
  EXERCISES,
  getExercise,
  type Equipment,
  type Goal,
  type Injury,
} from "../src/lib/exercise-db";
import {
  DEFAULT_PROFILE,
  analyzeExerciseStrength,
  estimateOneRepMaxKg,
  exerciseStrengthSummaries,
  normalizeReadinessCheckIn,
  readinessDateKey,
  readinessForDate,
  type CompletedWorkout,
  type DailyReadinessCheckIn,
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
const fixedToday = "2026-10-02";
const dailyStrong: DailyReadinessCheckIn = normalizeReadinessCheckIn({
  dateKey: fixedToday,
  recordedAt: "2026-10-02T08:00:00.000Z",
  sleepQuality: 5,
  fatigue: 1,
  muscleSoreness: 1,
  energy: 5,
});
const dailyProgressAdaptation = getTrainingAdaptation(
  strongProfile,
  strongHistory,
  dailyStrong,
  fixedToday,
);
if (
  dailyProgressAdaptation.mode !== "progress" ||
  dailyProgressAdaptation.readinessSource !== "daily-checkin"
) {
  fail(
    `strong today's check-in should produce daily progress, got ${dailyProgressAdaptation.mode}/${dailyProgressAdaptation.readinessSource}`,
  );
}

const dailyPoor: DailyReadinessCheckIn = normalizeReadinessCheckIn({
  dateKey: fixedToday,
  recordedAt: "2026-10-02T08:05:00.000Z",
  sleepQuality: 2,
  fatigue: 5,
  muscleSoreness: 5,
  energy: 1,
});
const dailyRecoveryAdaptation = getTrainingAdaptation(
  strongProfile,
  strongHistory,
  dailyPoor,
  fixedToday,
);
if (
  dailyRecoveryAdaptation.mode !== "recovery" ||
  dailyRecoveryAdaptation.readinessSource !== "daily-checkin"
) {
  fail(
    `poor today's check-in should force recovery, got ${dailyRecoveryAdaptation.mode}/${dailyRecoveryAdaptation.readinessSource}`,
  );
}

const stalePoor = {
  ...dailyPoor,
  dateKey: "2026-10-01",
};
const staleAdaptation = getTrainingAdaptation(
  strongProfile,
  strongHistory,
  stalePoor,
  fixedToday,
);
if (
  staleAdaptation.mode !== "progress" ||
  staleAdaptation.readinessSource !== "profile"
) {
  fail(
    `stale check-in must be ignored; expected profile progress, got ${staleAdaptation.mode}/${staleAdaptation.readinessSource}`,
  );
}

const selectedToday = readinessForDate(
  [stalePoor, dailyStrong],
  fixedToday,
);
if (selectedToday?.dateKey !== fixedToday) {
  fail("readinessForDate must select only the exact requested date");
}

const clampedReadiness = normalizeReadinessCheckIn({
  dateKey: fixedToday,
  recordedAt: "2026-10-02T09:00:00.000Z",
  sleepQuality: 9,
  fatigue: 0,
  muscleSoreness: 7,
  energy: -2,
});
if (
  clampedReadiness.sleepQuality !== 5 ||
  clampedReadiness.fatigue !== 1 ||
  clampedReadiness.muscleSoreness !== 5 ||
  clampedReadiness.energy !== 1
) {
  fail("daily readiness values must be clamped to the 1-5 scale");
}

const currentPoor: DailyReadinessCheckIn = {
  ...dailyPoor,
  dateKey: readinessDateKey(),
};
const dailyRecoveryPlan = generateWeeklyPlan(
  strongProfile,
  strongHistory,
  currentPoor,
);
if (
  !dailyRecoveryPlan.every(
    (workout) =>
      workout.adaptation.mode === "recovery" &&
      workout.adaptation.readinessSource === "daily-checkin" &&
      workout.periodization.phase === "deload",
  )
) {
  fail("today's poor check-in must propagate recovery/deload across the current weekly plan");
}

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

const skippedOnlyHistory = [
  historyEntry(
    "skipped-only",
    99,
    "bench-press",
    [12, 12, 12],
    120,
    0,
  ),
];
skippedOnlyHistory[0].exercises[0].completed = false;
skippedOnlyHistory[0].exercises[0].skipped = true;

if (analyzeExerciseStrength(skippedOnlyHistory, "bench-press") !== null) {
  fail("skipped-only exercise must not create strength analytics or PR data");
}

const oneCompletedOneSkipped = [
  historyEntry(
    "completed-before-skip",
    92,
    "bench-press",
    [12, 12, 12],
    70,
    2,
  ),
  historyEntry(
    "skipped-latest",
    99,
    "bench-press",
    [12, 12, 12],
    120,
    0,
  ),
];
oneCompletedOneSkipped[1].exercises[0].completed = false;
oneCompletedOneSkipped[1].exercises[0].skipped = true;

const skippedProgression = getExerciseProgressionPrescription(
  "bench-press",
  "8-12",
  oneCompletedOneSkipped,
  "progress",
);
if (skippedProgression.action === "increase-load") {
  fail("one completed + one skipped top-range attempt must not trigger load progression");
}
if (skippedProgression.lastLoadKg !== 70) {
  fail(
    `skipped 120kg attempt must not replace last completed load: got ${skippedProgression.lastLoadKg}`,
  );
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

const noEffortHistory = [
  historyEntry("no-rir-1", 90, "bench-press", [12, 12, 12], 70, 2),
  historyEntry("no-rir-2", 90, "bench-press", [12, 12, 12], 70, 2),
];
for (const workout of noEffortHistory) {
  delete workout.exercises[0].setRir;
  delete workout.exercises[0].setRpe;
}
const noEffortPrescription = getExerciseProgressionPrescription(
  "bench-press",
  "8-12",
  noEffortHistory,
  "progress",
);
if (noEffortPrescription.action !== "hold") {
  fail(
    `top-range sets without RIR must hold load, got ${noEffortPrescription.action}`,
  );
}

const plateauHistory: CompletedWorkout[] = [
  historyEntry("plateau-new", 86, "bench-press", [10, 10, 10], 70, 2),
  historyEntry("plateau-3", 86, "bench-press", [10, 10, 10], 70, 2),
  historyEntry("plateau-2", 86, "bench-press", [10, 10, 10], 70, 2),
  historyEntry("plateau-old", 86, "bench-press", [10, 10, 10], 70, 2),
];
plateauHistory[0].date = "2026-09-04T10:00:00.000Z";
plateauHistory[1].date = "2026-09-03T10:00:00.000Z";
plateauHistory[2].date = "2026-09-02T10:00:00.000Z";
plateauHistory[3].date = "2026-09-01T10:00:00.000Z";
const plateauAnalysis = analyzeExerciseStrength(
  plateauHistory,
  "bench-press",
);
if (!plateauAnalysis?.plateau) {
  fail("four flat strength sessions should be detected as a plateau");
}
if (plateauAnalysis?.trend !== "flat") {
  fail(`flat strength history should have flat trend, got ${plateauAnalysis?.trend}`);
}
if (plateauAnalysis?.latestLoadVolumeKgReps !== 2100) {
  fail(
    `70kg x 10 x 3 should produce 2100 kg-reps, got ${plateauAnalysis?.latestLoadVolumeKgReps}`,
  );
}

const risingHistory: CompletedWorkout[] = [
  historyEntry("rise-new", 90, "bench-press", [10, 10, 10], 72.5, 2),
  historyEntry("rise-3", 89, "bench-press", [10, 10, 10], 70, 2),
  historyEntry("rise-2", 88, "bench-press", [10, 10, 10], 67.5, 2),
  historyEntry("rise-old", 87, "bench-press", [10, 10, 10], 65, 2),
];
risingHistory[0].date = "2026-09-04T10:00:00.000Z";
risingHistory[1].date = "2026-09-03T10:00:00.000Z";
risingHistory[2].date = "2026-09-02T10:00:00.000Z";
risingHistory[3].date = "2026-09-01T10:00:00.000Z";
const risingAnalysis = analyzeExerciseStrength(
  risingHistory,
  "bench-press",
);
if (risingAnalysis?.trend !== "up") {
  fail(`rising strength history should trend up, got ${risingAnalysis?.trend}`);
}
if (!risingAnalysis?.latestLoadIsPr || !risingAnalysis.latestEstimated1RmIsPr) {
  fail("latest higher-load session should be detected as both load and e1RM PR");
}
if (risingAnalysis?.plateau) {
  fail("rising strength history must not be marked as plateau");
}

const monthlyCycle = generateMonthlyProgram(
  strongProfile,
  strongHistory,
);
const cyclePhases = monthlyCycle.map(
  (week) => week[0]?.periodization.phase,
);
const expectedCycle = [
  "accumulation",
  "progression",
  "intensification",
  "deload",
];
if (cyclePhases.join(",") !== expectedCycle.join(",")) {
  fail(
    `4-week periodization sequence mismatch: ${cyclePhases.join(",")}`,
  );
}

const phaseStrengthSets = monthlyCycle.map((week) =>
  week
    .flatMap((workout) => workout.exercises)
    .filter((item) =>
      ["main", "accessory", "core"].includes(item.phase),
    )
    .reduce((sum, item) => sum + item.sets, 0),
);
if (phaseStrengthSets[3] >= phaseStrengthSets[0]) {
  fail(
    `deload volume must be lower than accumulation: ${phaseStrengthSets[0]} -> ${phaseStrengthSets[3]}`,
  );
}

const accumulationMain = monthlyCycle[0]
  .flatMap((workout) => workout.exercises)
  .find((item) => item.phase === "main" && item.trackLoad);
const intensificationMain = monthlyCycle[2]
  .flatMap((workout) => workout.exercises)
  .find(
    (item) =>
      item.phase === "main" &&
      item.trackLoad &&
      item.exercise.id === accumulationMain?.exercise.id,
  );

function repRangeLow(value?: string) {
  const match = value?.match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

if (
  !accumulationMain ||
  !intensificationMain ||
  repRangeLow(intensificationMain.reps) >=
    repRangeLow(accumulationMain.reps)
) {
  fail(
    `intensification should use a lower main rep range than accumulation: ${accumulationMain?.reps} -> ${intensificationMain?.reps}`,
  );
}
if (
  accumulationMain &&
  intensificationMain &&
  intensificationMain.restSeconds <= accumulationMain.restSeconds
) {
  fail(
    `intensification should have longer rest: ${accumulationMain.restSeconds} -> ${intensificationMain.restSeconds}`,
  );
}
if (
  monthlyCycle[3].some(
    (workout) =>
      !workout.isDeload ||
      workout.periodization.targetRir !== "3-4",
  )
) {
  fail("week 4 must be a deload with target RIR 3-4");
}

const recoveryPeriodization = getPeriodizationPlan(
  0,
  poorProfile,
  poorHistory,
);
if (
  recoveryPeriodization.phase !== "deload" ||
  recoveryPeriodization.trigger !== "recovery"
) {
  fail(
    `recovery should override cycle into deload, got ${recoveryPeriodization.phase}/${recoveryPeriodization.trigger}`,
  );
}

const multiPlateauHistory = plateauHistory.map((workout) => ({
  ...workout,
  exercises: [
    ...workout.exercises,
    {
      id: "squat",
      sets: 3,
      reps: "6-8",
      completed: true,
      setReps: [8, 8, 8],
      setLoadsKg: [100, 100, 100],
      setRir: [2, 2, 2],
      setRpe: [8, 8, 8],
    },
  ],
}));
const plateauPeriodization = getPeriodizationPlan(
  2,
  strongProfile,
  multiPlateauHistory,
);
if (
  plateauPeriodization.phase !== "deload" ||
  plateauPeriodization.trigger !== "plateau" ||
  plateauPeriodization.plateauCount < 2
) {
  fail(
    `two simultaneous plateaus in intensification should trigger early deload, got ${plateauPeriodization.phase}/${plateauPeriodization.trigger} plateaus=${plateauPeriodization.plateauCount}`,
  );
}

for (const exercise of EXERCISES) {
  for (const alternativeId of exercise.alternatives) {
    const alternative = getExercise(alternativeId);
    if (!alternative) {
      fail(`missing alternative ${alternativeId} for ${exercise.id}`);
      continue;
    }
    if (
      alternative.movementFamily !== exercise.movementFamily ||
      alternative.primary[0] !== exercise.primary[0] ||
      alternative.trainingRole !== exercise.trainingRole ||
      alternative.exerciseType !== exercise.exerciseType
    ) {
      fail(
        `unsafe alternative mapping ${exercise.id} -> ${alternative.id}`,
      );
    }
    if (
      !alternative.equipment.some((item) =>
        exercise.equipment.includes(item),
      )
    ) {
      fail(
        `alternative changed equipment pattern ${exercise.id} -> ${alternative.id}`,
      );
    }
  }
}

const rotationAccessoryBase = EXERCISES.find(
  (exercise) =>
    exercise.trainingRole === "accessory" &&
    exercise.alternatives.length > 0 &&
    exercise.equipment.every((item) =>
      strongProfile.equipment.includes(item),
    ),
);
if (!rotationAccessoryBase) {
  fail("expected at least one strict accessory rotation candidate");
} else {
  const baseline = getExerciseRotationDecision(
    rotationAccessoryBase,
    strongProfile,
    [],
    0,
    "accessory",
  );
  if (baseline.exercise.id !== rotationAccessoryBase.id || baseline.reason) {
    fail("mesocycle zero should keep the baseline accessory");
  }

  const rotatedWeeks = [4, 5, 6, 7].map((week) =>
    getExerciseRotationDecision(
      rotationAccessoryBase,
      strongProfile,
      [],
      week,
      "accessory",
    ),
  );
  const rotatedId = rotatedWeeks[0]?.exercise.id;
  if (
    !rotatedId ||
    rotatedId === rotationAccessoryBase.id ||
    rotatedWeeks.some(
      (decision) =>
        decision.exercise.id !== rotatedId ||
        decision.reason !== "mesocycle",
    )
  ) {
    fail(
      `accessory rotation must stay stable across one mesocycle: ${rotatedWeeks
        .map((decision) => decision.exercise.id)
        .join(">")}`,
    );
  }

  const rotated = rotatedWeeks[0]?.exercise;
  if (
    rotated &&
    (rotated.movementFamily !== rotationAccessoryBase.movementFamily ||
      rotated.primary[0] !== rotationAccessoryBase.primary[0] ||
      !rotated.equipment.some((item) =>
        rotationAccessoryBase.equipment.includes(item),
      ))
  ) {
    fail(
      `rotated accessory changed movement/muscle/equipment: ${rotationAccessoryBase.id} -> ${rotated.id}`,
    );
  }

  const historyChanged = [
    historyEntry(
      "rotation-history",
      88,
      rotatedId ?? rotationAccessoryBase.id,
      [10, 10, 10],
      20,
      2,
    ),
  ];
  const afterHistoryUpdate = getExerciseRotationDecision(
    rotationAccessoryBase,
    strongProfile,
    historyChanged,
    6,
    "accessory",
  );
  if (afterHistoryUpdate.exercise.id !== rotatedId) {
    fail(
      "adding workout history inside a mesocycle must not change its selected accessory variant",
    );
  }
}

const rotationMainBase = EXERCISES.find(
  (exercise) =>
    exercise.trainingRole === "main" &&
    exercise.exerciseType === "weight_reps" &&
    exercise.alternatives.length > 0 &&
    exercise.equipment.every((item) =>
      strongProfile.equipment.includes(item),
    ),
);
if (!rotationMainBase) {
  fail("expected at least one strict main rotation candidate");
} else {
  const stableMain = getExerciseRotationDecision(
    rotationMainBase,
    strongProfile,
    [],
    4,
    "main",
  );
  if (stableMain.exercise.id !== rotationMainBase.id || stableMain.reason) {
    fail("main exercise must remain stable across mesocycles without plateau");
  }

  const mainPlateauHistory = [
    historyEntry(
      "main-plateau-new",
      86,
      rotationMainBase.id,
      [10, 10, 10],
      70,
      2,
    ),
    historyEntry(
      "main-plateau-3",
      86,
      rotationMainBase.id,
      [10, 10, 10],
      70,
      2,
    ),
    historyEntry(
      "main-plateau-2",
      86,
      rotationMainBase.id,
      [10, 10, 10],
      70,
      2,
    ),
    historyEntry(
      "main-plateau-old",
      86,
      rotationMainBase.id,
      [10, 10, 10],
      70,
      2,
    ),
  ];
  mainPlateauHistory.forEach((workout, index) => {
    workout.date = `2026-08-0${4 - index}T10:00:00.000Z`;
  });

  const plateauRotation = getExerciseRotationDecision(
    rotationMainBase,
    strongProfile,
    mainPlateauHistory,
    4,
    "main",
  );
  if (
    plateauRotation.reason !== "plateau" ||
    plateauRotation.exercise.id === rotationMainBase.id
  ) {
    fail(
      `plateau main lift should rotate to a strict alternative, got ${plateauRotation.exercise.id}/${plateauRotation.reason}`,
    );
  }
}

const manualSwapPlan = generateWeeklyPlan(strongProfile, strongHistory);
let manualSwapCase:
  | {
      workout: (typeof manualSwapPlan)[number];
      item: (typeof manualSwapPlan)[number]["exercises"][number];
      replacementId: string;
    }
  | undefined;

for (const workout of manualSwapPlan) {
  const usedIds = new Set(workout.exercises.map((item) => item.exercise.id));
  for (const item of workout.exercises) {
    if (
      item.phase !== "main" &&
      item.phase !== "accessory" &&
      item.phase !== "core"
    ) {
      continue;
    }
    const options = getManualExerciseSwapOptions(
      item.exercise,
      strongProfile,
      usedIds,
      4,
    );
    const replacement = options[0];
    if (!replacement) continue;

    if (options.some((option) => usedIds.has(option.id))) {
      fail("manual swap options must not repeat an exercise already in the session");
    }
    if (
      replacement.movementFamily !== item.exercise.movementFamily ||
      replacement.primary[0] !== item.exercise.primary[0] ||
      replacement.trainingRole !== item.exercise.trainingRole ||
      replacement.exerciseType !== item.exercise.exerciseType
    ) {
      fail(
        `manual swap changed movement contract: ${item.exercise.id} -> ${replacement.id}`,
      );
    }
    if (
      replacement.equipment.some(
        (equipment) => !strongProfile.equipment.includes(equipment),
      ) ||
      !isSafeFor(replacement, strongProfile.injuries)
    ) {
      fail(
        `manual swap leaked unavailable/unsafe replacement: ${replacement.id}`,
      );
    }

    manualSwapCase = {
      workout,
      item,
      replacementId: replacement.id,
    };
    break;
  }
  if (manualSwapCase) break;
}

if (!manualSwapCase) {
  fail("expected at least one strict manual exercise swap option");
} else {
  const replacement = getExercise(manualSwapCase.replacementId);
  if (!replacement) {
    fail("manual swap replacement disappeared from exercise database");
  } else {
    const swapped = createManualExerciseSwap(
      manualSwapCase.item,
      replacement,
      strongProfile,
      strongHistory,
      manualSwapCase.workout.adaptation,
      manualSwapCase.workout.periodization,
      manualSwapCase.workout.isDeload,
    );
    if (
      !swapped ||
      swapped.exercise.id !== replacement.id ||
      swapped.rotatedFromId !== manualSwapCase.item.exercise.id ||
      swapped.rotationReason !== "manual" ||
      swapped.sets !== manualSwapCase.item.sets
    ) {
      fail(
        "manual swap must preserve volume and record manual rotation provenance",
      );
    }

    const incompatible = EXERCISES.find(
      (candidate) =>
        candidate.id !== manualSwapCase?.item.exercise.id &&
        candidate.movementFamily !==
          manualSwapCase?.item.exercise.movementFamily,
    );
    if (
      incompatible &&
      createManualExerciseSwap(
        manualSwapCase.item,
        incompatible,
        strongProfile,
        strongHistory,
        manualSwapCase.workout.adaptation,
        manualSwapCase.workout.periodization,
        manualSwapCase.workout.isDeload,
      )
    ) {
      fail("manual swap helper accepted an incompatible movement pattern");
    }
  }
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
  `adaptive checks: progress readiness=${progressAdaptation.readinessScore}, recovery readiness=${recoveryAdaptation.readinessScore}, daily=${dailyProgressAdaptation.readinessScore}->${dailyRecoveryAdaptation.readinessScore}, staleSource=${staleAdaptation.readinessSource}, strength sets ${progressStrengthSets}->${recoveryStrengthSets}, load 70->${loadPrescription.suggestedLoadKg}kg, e1RM=${e1rm}kg, plateau=${plateauAnalysis?.plateau}, trend=${risingAnalysis?.trend}, cycle=${cyclePhases.join(">")}, cycleSets=${phaseStrengthSets.join(">")}, recoveryPhase=${recoveryPeriodization.phase}, plateauTrigger=${plateauPeriodization.trigger}, accessoryRotation=${rotationAccessoryBase?.id ?? "none"}, mainRotation=${rotationMainBase?.id ?? "none"}, manualSwap=${manualSwapCase?.item.exercise.id ?? "none"}->${manualSwapCase?.replacementId ?? "none"}`,
);

const injuryScenarios: Injury[][] = [
  ["knee"],
  ["shoulder"],
  ["lower-back"],
  ["wrist"],
  ["ankle"],
  ["hip"],
  ["shoulder", "wrist"],
];

for (const injuries of injuryScenarios) {
  const injuryProfile: UserProfile = {
    ...DEFAULT_PROFILE,
    level: "intermediate",
    goals: ["general-fitness"],
    equipment: FULL_EQUIPMENT,
    injuries,
    daysPerWeek: 4,
    sessionMinutes: 45,
  };
  const injuryPlan = generateWeeklyPlan(injuryProfile);

  for (const [dayIndex, workout] of injuryPlan.entries()) {
    const unsafe = workout.exercises.filter(
      (item) => !isSafeFor(item.exercise, injuries),
    );
    if (unsafe.length) {
      fail(
        `injury ${injuries.join("+")} day ${dayIndex + 1}: unsafe exercises leaked into plan: ${unsafe
          .map((item) => item.exercise.id)
          .join(",")}`,
      );
    }

    const strengthCount = workout.exercises.filter((item) =>
      ["main", "accessory", "core"].includes(item.phase),
    ).length;
    if (strengthCount < 1 || workout.exercises.length < 3) {
      fail(
        `injury ${injuries.join("+")} day ${dayIndex + 1}: safety filtering left the workout too sparse (${strengthCount} strength / ${workout.exercises.length} total)`,
      );
    }

    if (
      !workout.safetyAdjusted ||
      injuries.some(
        (injury) => !workout.screeningInjuries.includes(injury),
      )
    ) {
      fail(
        `injury ${injuries.join("+")} day ${dayIndex + 1}: safety metadata missing`,
      );
    }
  }
}

console.log(
  "injury safety checks: " +
    injuryScenarios.map((items) => items.join("+")).join(", "),
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
  const recoverySpacing = getWeeklyRecoverySpacing(schedule);
  const movementBalance = getWeeklyMovementBalance(plan);
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

  for (const item of recoverySpacing) {
    if (item.exposureDays < 2) {
      fail(
        `${daysPerWeek}d: ${item.muscle} has only ${item.exposureDays} targeted exposure day(s) for recovery audit`,
      );
      continue;
    }
    if (
      item.status !== "optimal" ||
      item.minGapDays === null ||
      item.minGapDays < 2
    ) {
      fail(
        `${daysPerWeek}d: ${item.muscle} recovery spacing is too tight: ${item.dayLabels.join(">")} minGap=${item.minGapDays}`,
      );
    }
  }

  if (movementBalance.length !== 6) {
    fail(
      `${daysPerWeek}d: expected 6 movement-balance groups, got ${movementBalance.length}`,
    );
  }

  if (daysPerWeek >= 3) {
    const missingPatterns = movementBalance.filter(
      (item) => item.status === "missing",
    );
    if (missingPatterns.length) {
      fail(
        `${daysPerWeek}d: missing weekly movement patterns: ${missingPatterns
          .map((item) => item.pattern)
          .join(",")}`,
      );
    }
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
      volume.map((item) => `${item.muscle}=${item.effectiveSets}/${item.min}-${item.max}`).join(", ") +
      " | recovery " +
      recoverySpacing.map((item) => `${item.muscle}=${item.minGapDays}d`).join(", ") +
      " | movement " +
      movementBalance
        .map((item) => `${item.pattern}=${item.days}d/${item.exerciseCount}ex`)
        .join(", "),
  );
}

if (failures.length) {
  console.error("\nWorkout programming quality gate FAILED:\n");
  failures.forEach((message) => console.error("- " + message));
  process.exit(1);
}

console.log("\nWorkout programming quality gate PASS.");
