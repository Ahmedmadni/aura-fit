/**
 * Balanced workout programming engine.
 *
 * Session order: warm-up -> main lifts -> accessories -> core/cardio -> cooldown.
 * Weekly splits adapt to 2–6 training days and repeat major muscle exposure.
 */

import {
  EXERCISES,
  getExercise,
  type Category,
  type Equipment,
  type Exercise,
  type Goal,
  type Injury,
  type Level,
  type Muscle,
} from "./exercise-db";
import type { CompletedWorkout, UserProfile } from "./user-profile";

export type TrainingPhase =
  | "warmup"
  | "main"
  | "accessory"
  | "core"
  | "cardio"
  | "cooldown";

export type AdaptationMode = "progress" | "maintain" | "recovery";
export type ProgressionAction =
  | "build-reps"
  | "increase-load"
  | "hold"
  | "reduce";

export interface TrainingAdaptation {
  mode: AdaptationMode;
  readinessScore: number;
  recentPerformance: number;
  recentSessions: number;
  volumeFactor: number;
  restFactor: number;
  reason: string;
}

export interface PlannedExercise {
  exercise: Exercise;
  phase: TrainingPhase;
  sets: number;
  reps: string;
  restSeconds: number;
  workSeconds: number;
  progressionAction: ProgressionAction;
  progressionNote: string;
}

export interface GeneratedWorkout {
  id: string;
  title: string;
  splitKey: string;
  focus: Category[];
  targetMuscles: Muscle[];
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  estimatedCalories: number;
  intensity: number;
  isDeload: boolean;
  adaptation: TrainingAdaptation;
  rationale: string;
}

export interface MuscleCoverage {
  muscle: Muscle;
  days: number;
  directSets: number;
  indirectSets: number;
}

export interface MuscleVolumeTarget {
  muscle: Muscle;
  min: number;
  target: number;
  max: number;
}

export interface MuscleVolumeStatus extends MuscleCoverage, MuscleVolumeTarget {
  effectiveSets: number;
  status: "low" | "target" | "high";
}

export interface WeeklyScheduleDay {
  weekday: number;
  dayLabel: string;
  isRest: boolean;
  workoutIndex?: number;
  workout?: GeneratedWorkout;
}

type DayBlueprint = {
  key: string;
  title: string;
  focus: Category[];
  targetMuscles: Muscle[];
  mainTargets: Muscle[];
  accessoryTargets: Muscle[];
  includeCore: boolean;
  includeCardio: boolean;
};

const LEVEL_RANK: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 3 };

export const WEEKDAY_LABEL_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

const TRAINING_DAY_PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getTrainingAdaptation(
  profile: UserProfile,
  history: CompletedWorkout[] = [],
): TrainingAdaptation {
  const recent = history.slice(0, 3);
  const recentPerformance = recent.length
    ? Math.round(
        recent.reduce((sum, workout) => sum + workout.performance, 0) /
          recent.length,
      )
    : 75;

  const readinessScore = clampScore(
    50 +
      (profile.sleepQuality - 3) * 10 -
      (profile.fatigue - 3) * 10 +
      (recentPerformance - 75) * 0.3,
  );

  const recoveryRequired =
    readinessScore < 55 ||
    profile.sleepQuality <= 2 ||
    profile.fatigue >= 4 ||
    (recent.length >= 2 && recentPerformance < 65);

  const progressReady =
    recent.length >= 2 &&
    readinessScore >= 80 &&
    recentPerformance >= 85 &&
    profile.sleepQuality >= 4 &&
    profile.fatigue <= 2;

  if (recoveryRequired) {
    return {
      mode: "recovery",
      readinessScore,
      recentPerformance,
      recentSessions: recent.length,
      volumeFactor: 0.78,
      restFactor: 1.25,
      reason:
        "تم خفض الجرعة التدريبية مؤقتًا لأن مؤشرات النوم/الإجهاد أو الأداء الحديث تشير إلى حاجة أكبر للاستشفاء.",
    };
  }

  if (progressReady) {
    return {
      mode: "progress",
      readinessScore,
      recentPerformance,
      recentSessions: recent.length,
      volumeFactor: 1.05,
      restFactor: 1,
      reason:
        "الأداء الحديث مستقر والجاهزية مرتفعة؛ تُستخدم زيادة تدريجية محافظة في التكرارات أو المقاومة.",
    };
  }

  return {
    mode: "maintain",
    readinessScore,
    recentPerformance,
    recentSessions: recent.length,
    volumeFactor: 1,
    restFactor: 1,
    reason:
      recent.length < 2
        ? "لا توجد بيانات أداء كافية للزيادة التلقائية بعد؛ تستمر الخطة على جرعتها الحالية."
        : "مؤشرات الأداء والاستشفاء متوازنة؛ تستمر الخطة على الجرعة الحالية مع بناء التكرارات تدريجيًا.",
  };
}

function parseRepRange(reps: string): { low: number; high: number } | undefined {
  const range = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    return { low: Number(range[1]), high: Number(range[2]) };
  }
  const single = reps.match(/^\s*(\d+)\s*$/);
  if (single) {
    const value = Number(single[1]);
    return { low: value, high: value };
  }
  return undefined;
}

function exerciseAttempts(
  exerciseId: string,
  history: CompletedWorkout[],
  limit = 2,
) {
  const attempts: CompletedWorkout["exercises"][number][] = [];
  for (const workout of history) {
    const exercise = workout.exercises.find((item) => item.id === exerciseId);
    if (!exercise) continue;
    attempts.push(exercise);
    if (attempts.length >= limit) break;
  }
  return attempts;
}

export function getExerciseProgressionPrescription(
  exerciseId: string,
  baseReps: string,
  history: CompletedWorkout[],
  adaptationMode: AdaptationMode,
): {
  reps: string;
  action: ProgressionAction;
  note: string;
} {
  const range = parseRepRange(baseReps);
  if (!range) {
    return {
      reps: baseReps,
      action: adaptationMode === "recovery" ? "reduce" : "hold",
      note:
        adaptationMode === "recovery"
          ? "حافظ على شدة مريحة اليوم ولا تطارد زيادة في السرعة أو المقاومة."
          : "حافظ على التقنية والزمن المستهدف قبل رفع الشدة.",
    };
  }

  const attempts = exerciseAttempts(exerciseId, history, 2);
  if (adaptationMode === "recovery") {
    return {
      reps: baseReps,
      action: "reduce",
      note:
        "استخدم مقاومة أخف من المعتاد إذا لزم، واترك 2–4 تكرارات احتياطية مع الحفاظ على نفس التقنية.",
    };
  }

  if (attempts.length >= 2) {
    const bothHitTop = attempts.every(
      (attempt) =>
        attempt.completed &&
        (attempt.setReps?.length ?? 0) >= Math.max(1, attempt.sets) &&
        (attempt.setReps ?? []).every((reps) => reps >= range.high),
    );

    if (bothHitTop) {
      return {
        reps: baseReps,
        action: "increase-load",
        note:
          "بلغت الحد الأعلى للنطاق في آخر جلستين: ارفع المقاومة أصغر خطوة متاحة ثم ابدأ من الحد الأدنى للنطاق.",
      };
    }

    const recentAverages = attempts
      .map((attempt) => {
        const values = attempt.setReps ?? [];
        if (!values.length) return undefined;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      })
      .filter((value): value is number => value !== undefined);

    if (
      recentAverages.length >= 2 &&
      recentAverages.every((average) => average < range.low)
    ) {
      return {
        reps: baseReps,
        action: "reduce",
        note:
          "آخر محاولتين كانتا دون الحد الأدنى للنطاق؛ خفّض المقاومة قليلًا أو ثبّتها حتى تستعيد جودة التكرارات.",
      };
    }

    const lastAverage = recentAverages[0];
    if (lastAverage !== undefined && lastAverage >= range.low) {
      const raisedLow = Math.min(range.high, range.low + 1);
      return {
        reps:
          raisedLow < range.high
            ? `${raisedLow}-${range.high}`
            : String(range.high),
        action: "build-reps",
        note:
          "حافظ على نفس المقاومة وحاول إضافة تكرار واحد لكل مجموعة حتى تصل إلى الحد الأعلى للنطاق.",
      };
    }
  }

  return {
    reps: baseReps,
    action: "hold",
    note:
      "ثبّت المقاومة وركز على إكمال كل المجموعات داخل النطاق قبل طلب زيادة جديدة.",
  };
}


export const PHASE_LABEL_AR: Record<TrainingPhase, string> = {
  warmup: "إحماء",
  main: "التمارين الأساسية",
  accessory: "تمارين مساعدة",
  core: "كور",
  cardio: "كارديو",
  cooldown: "تهدئة واستشفاء",
};

export const MAJOR_MUSCLES: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "quads",
  "hamstrings",
  "glutes",
  "core",
];

const SMALLER_MUSCLES: Muscle[] = ["biceps", "triceps", "calves", "forearms"];

function baseVolumeForLevel(level: Level) {
  if (level === "beginner") return { min: 4, target: 6, max: 9 };
  if (level === "advanced") return { min: 8, target: 12, max: 18 };
  return { min: 6, target: 9, max: 14 };
}

function goalVolumeAdjustment(goals: Goal[]) {
  if (goals.includes("muscle-gain")) return { min: 1, target: 3, max: 4 };
  if (goals.includes("strength")) return { min: 0, target: 1, max: 2 };
  if (goals.includes("endurance")) return { min: 0, target: 1, max: 2 };
  return { min: 0, target: 0, max: 0 };
}

export function getWeeklyVolumeTargets(
  profile: UserProfile,
  isDeload = false,
  adaptationMode: AdaptationMode = "maintain",
): MuscleVolumeTarget[] {
  const base = baseVolumeForLevel(profile.level);
  const adjustment = goalVolumeAdjustment(profile.goals);
  const adaptationFactor =
    adaptationMode === "recovery" ? 0.78 : adaptationMode === "progress" ? 1.05 : 1;
  const deloadFactor = isDeload ? 0.65 : adaptationFactor;

  return MAJOR_MUSCLES.map((muscle) => {
    const coreFactor = muscle === "core" ? 0.75 : 1;
    const min = Math.max(
      2,
      Math.round((base.min + adjustment.min) * coreFactor * deloadFactor),
    );
    const target = Math.max(
      min,
      Math.round((base.target + adjustment.target) * coreFactor * deloadFactor),
    );
    const maxFactor = muscle === "core" ? 1 : coreFactor;
    const max = Math.max(
      target + 1,
      Math.round((base.max + adjustment.max) * maxFactor * deloadFactor),
    );
    return { muscle, min, target, max };
  });
}

const ALL_FULL_BODY: Muscle[] = [
  "chest",
  "back",
  "shoulders",
  "quads",
  "hamstrings",
  "glutes",
  "core",
];

const FULL_BODY_A: DayBlueprint = {
  key: "full-a",
  title: "كامل الجسم A",
  focus: ["push", "pull", "legs", "core"],
  targetMuscles: ALL_FULL_BODY,
  mainTargets: ["quads", "chest", "back", "hamstrings", "shoulders"],
  accessoryTargets: ["glutes", "biceps", "triceps"],
  includeCore: true,
  includeCardio: false,
};
const FULL_BODY_B: DayBlueprint = {
  key: "full-b",
  title: "كامل الجسم B",
  focus: ["legs", "pull", "push", "core"],
  targetMuscles: ALL_FULL_BODY,
  mainTargets: ["hamstrings", "back", "chest", "quads", "shoulders"],
  accessoryTargets: ["glutes", "triceps", "biceps"],
  includeCore: true,
  includeCardio: true,
};
const FULL_BODY_C: DayBlueprint = {
  key: "full-c",
  title: "كامل الجسم C",
  focus: ["push", "legs", "pull", "core"],
  targetMuscles: ALL_FULL_BODY,
  mainTargets: ["glutes", "shoulders", "back", "quads", "chest"],
  accessoryTargets: ["hamstrings", "biceps", "triceps"],
  includeCore: true,
  includeCardio: false,
};
const UPPER_A: DayBlueprint = {
  key: "upper-a",
  title: "الجزء العلوي A",
  focus: ["push", "pull", "core"],
  targetMuscles: ["chest", "back", "shoulders", "biceps", "triceps", "core"],
  mainTargets: ["chest", "back", "shoulders", "back"],
  accessoryTargets: ["biceps", "triceps", "shoulders"],
  includeCore: true,
  includeCardio: false,
};
const UPPER_B: DayBlueprint = {
  key: "upper-b",
  title: "الجزء العلوي B",
  focus: ["pull", "push", "core"],
  targetMuscles: ["back", "chest", "shoulders", "biceps", "triceps", "core"],
  mainTargets: ["back", "shoulders", "chest", "back"],
  accessoryTargets: ["triceps", "biceps", "shoulders"],
  includeCore: true,
  includeCardio: false,
};
const LOWER_A: DayBlueprint = {
  key: "lower-a",
  title: "الجزء السفلي A",
  focus: ["legs", "core"],
  targetMuscles: ["quads", "hamstrings", "glutes", "calves", "core"],
  mainTargets: ["quads", "hamstrings", "glutes", "quads"],
  accessoryTargets: ["calves", "hamstrings", "glutes"],
  includeCore: true,
  includeCardio: false,
};
const LOWER_B: DayBlueprint = {
  key: "lower-b",
  title: "الجزء السفلي B",
  focus: ["legs", "core"],
  targetMuscles: ["hamstrings", "glutes", "quads", "calves", "core"],
  mainTargets: ["hamstrings", "glutes", "quads", "hamstrings"],
  accessoryTargets: ["calves", "quads", "glutes"],
  includeCore: true,
  includeCardio: true,
};
const PUSH_A: DayBlueprint = {
  key: "push-a",
  title: "دفع A",
  focus: ["push", "core"],
  targetMuscles: ["chest", "shoulders", "triceps", "core"],
  mainTargets: ["chest", "shoulders", "chest"],
  accessoryTargets: ["triceps", "shoulders"],
  includeCore: true,
  includeCardio: false,
};
const PUSH_B: DayBlueprint = {
  key: "push-b",
  title: "دفع B",
  focus: ["push", "core"],
  targetMuscles: ["shoulders", "chest", "triceps", "core"],
  mainTargets: ["shoulders", "chest", "shoulders"],
  accessoryTargets: ["triceps", "chest"],
  includeCore: true,
  includeCardio: false,
};
const PULL_A: DayBlueprint = {
  key: "pull-a",
  title: "سحب A",
  focus: ["pull", "core"],
  targetMuscles: ["back", "biceps", "forearms", "core"],
  mainTargets: ["back", "back", "biceps"],
  accessoryTargets: ["biceps", "forearms"],
  includeCore: true,
  includeCardio: false,
};
const PULL_B: DayBlueprint = {
  key: "pull-b",
  title: "سحب B",
  focus: ["pull", "core"],
  targetMuscles: ["back", "biceps", "forearms", "core"],
  mainTargets: ["back", "biceps", "back"],
  accessoryTargets: ["forearms", "biceps"],
  includeCore: true,
  includeCardio: false,
};
const LEGS_A: DayBlueprint = {
  key: "legs-a",
  title: "أرجل A",
  focus: ["legs", "core"],
  targetMuscles: ["quads", "hamstrings", "glutes", "calves", "core"],
  mainTargets: ["quads", "hamstrings", "glutes", "quads"],
  accessoryTargets: ["calves", "hamstrings"],
  includeCore: true,
  includeCardio: false,
};
const LEGS_B: DayBlueprint = {
  key: "legs-b",
  title: "أرجل B",
  focus: ["legs", "core"],
  targetMuscles: ["hamstrings", "glutes", "quads", "calves", "core"],
  mainTargets: ["hamstrings", "glutes", "quads", "hamstrings"],
  accessoryTargets: ["calves", "quads"],
  includeCore: true,
  includeCardio: false,
};

function blueprintsFor(daysPerWeek: number): DayBlueprint[] {
  const days = Math.max(1, Math.min(6, Math.round(daysPerWeek || 3)));
  if (days === 1) return [FULL_BODY_A];
  if (days === 2) return [FULL_BODY_A, FULL_BODY_B];
  if (days === 3) return [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C];
  if (days === 4) return [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
  if (days === 5) return [PUSH_A, PULL_A, LEGS_A, UPPER_B, LOWER_B];
  return [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B];
}

export function isSafeFor(ex: Exercise, injuries: Injury[]): boolean {
  return !ex.contraindicated.some((tag) => injuries.includes(tag));
}

export function hasEquipment(ex: Exercise, owned: Equipment[]): boolean {
  return ex.equipment.every((item) => owned.includes(item) || item === "none");
}

function isEligible(ex: Exercise, profile: UserProfile): boolean {
  return (
    LEVEL_RANK[ex.level] <= LEVEL_RANK[profile.level] + 1 &&
    isSafeFor(ex, profile.injuries) &&
    hasEquipment(ex, profile.equipment)
  );
}

export function replaceUnsafe(ex: Exercise, injuries: Injury[], equipment: Equipment[]): Exercise {
  if (isSafeFor(ex, injuries) && hasEquipment(ex, equipment)) return ex;
  const alternatives = ex.alternatives
    .map(getExercise)
    .filter((candidate): candidate is Exercise => Boolean(candidate))
    .filter((candidate) => isSafeFor(candidate, injuries) && hasEquipment(candidate, equipment));
  if (alternatives[0]) return alternatives[0];
  return (
    EXERCISES.find(
      (candidate) =>
        candidate.category === ex.category &&
        isSafeFor(candidate, injuries) &&
        hasEquipment(candidate, equipment),
    ) ?? ex
  );
}

function goalBonus(ex: Exercise, goals: Goal[]) {
  return goals.length && ex.goals.some((goal) => goals.includes(goal)) ? 2 : 0;
}

function scoreForMuscle(
  ex: Exercise,
  muscle: Muscle,
  preferredRole: "main" | "accessory",
  profile: UserProfile,
  usedSession: Set<string>,
  usedAcrossWeek: Set<string>,
) {
  if (usedSession.has(ex.id)) return -Infinity;
  const primary = ex.primary.includes(muscle);
  const secondary = ex.secondary.includes(muscle);
  if (!primary && !secondary) return -Infinity;
  let score = primary ? 12 : 4;
  if (ex.trainingRole === preferredRole) score += 4;
  if (ex.trainingRole === "main" && preferredRole === "accessory") score += 1;
  score += goalBonus(ex, profile.goals);
  if (ex.media.preferred === "gif") score += 0.25;
  if (usedAcrossWeek.has(ex.id)) score -= 4;
  return score;
}

function strengthPool(profile: UserProfile) {
  return EXERCISES.filter(
    (ex) =>
      (ex.trainingRole === "main" || ex.trainingRole === "accessory") &&
      isEligible(ex, profile),
  );
}

function chooseStrength(
  target: Muscle,
  preferredRole: "main" | "accessory",
  profile: UserProfile,
  usedSession: Set<string>,
  usedAcrossWeek: Set<string>,
): Exercise | undefined {
  return strengthPool(profile)
    .map((exercise) => ({
      exercise,
      score: scoreForMuscle(exercise, target, preferredRole, profile, usedSession, usedAcrossWeek),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id))[0]?.exercise;
}

function chooseFromIds(ids: string[], profile: UserProfile, usedSession: Set<string>, limit: number) {
  const chosen: Exercise[] = [];
  for (const id of ids) {
    if (chosen.length >= limit) break;
    const exercise = getExercise(id);
    if (!exercise || usedSession.has(exercise.id) || !isEligible(exercise, profile)) continue;
    chosen.push(exercise);
    usedSession.add(exercise.id);
  }
  return chosen;
}

function warmupIds(blueprint: DayBlueprint) {
  const lower = blueprint.focus.includes("legs");
  const upper = blueprint.focus.includes("push") || blueprint.focus.includes("pull");
  if (lower && upper) return ["inchworm", "leg-swings-stretch", "arm-circles", "worlds-greatest-stretch"];
  if (lower) return ["leg-swings-stretch", "worlds-greatest-stretch", "inchworm", "high-knees"];
  return ["arm-circles", "inchworm", "torso-twist-stretch", "jumping-jack"];
}

function cooldownIds(blueprint: DayBlueprint) {
  if (blueprint.focus.includes("legs")) {
    return ["hamstring-stretch", "standing-quad-stretch", "wall-calf-stretch", "kneeling-hip-flexor-stretch"];
  }
  if (blueprint.focus.includes("push")) {
    return ["doorway-chest-stretch", "cross-body-shoulder-stretch", "cat-cow-stretch"];
  }
  return ["childs-pose", "cross-body-shoulder-stretch", "cat-cow-stretch"];
}

function setsFor(
  profile: UserProfile,
  phase: TrainingPhase,
  isDeload: boolean,
  adaptation: TrainingAdaptation,
) {
  if (phase === "warmup" || phase === "cooldown" || phase === "cardio") return 1;
  if (phase === "core") return isDeload ? 1 : 2;
  let sets = phase === "main" ? (profile.level === "beginner" ? 2 : 3) : profile.level === "advanced" ? 3 : 2;
  if (profile.goals.includes("muscle-gain") && phase === "main") sets += 1;
  if (profile.goals.includes("strength") && phase === "main") sets = Math.max(3, sets);
  if (isDeload) sets = Math.max(1, sets - 1);
  if (adaptation.mode === "recovery") sets = Math.max(1, sets - 1);
  return sets;
}

function repsFor(exercise: Exercise, profile: UserProfile, phase: TrainingPhase) {
  if (phase === "warmup") return "45-60 ثانية";
  if (phase === "cooldown") return "30-45 ثانية";
  if (phase === "cardio") return "5-10 دقائق";
  if (exercise.exerciseType === "duration" || phase === "core") return exercise.recommendedReps;
  if (profile.goals.includes("strength") && phase === "main") return "5-8";
  if (profile.goals.includes("muscle-gain")) return "8-12";
  if (profile.goals.includes("endurance") || profile.goals.includes("fat-loss")) return "12-15";
  return exercise.recommendedReps;
}

function planned(
  exercise: Exercise,
  phase: TrainingPhase,
  profile: UserProfile,
  isDeload: boolean,
  adaptation: TrainingAdaptation,
  history: CompletedWorkout[],
): PlannedExercise {
  const baseReps = repsFor(exercise, profile, phase);
  const prescription =
    phase === "main" || phase === "accessory" || phase === "core"
      ? getExerciseProgressionPrescription(
          exercise.id,
          baseReps,
          history,
          adaptation.mode,
        )
      : {
          reps: baseReps,
          action: adaptation.mode === "recovery" ? ("reduce" as const) : ("hold" as const),
          note:
            adaptation.mode === "recovery"
              ? "استخدم إيقاعًا مريحًا وحافظ على التنفس وجودة الحركة."
              : "حافظ على الإيقاع والتقنية المستهدفة.",
        };

  const baseRest =
    phase === "warmup" || phase === "cooldown"
      ? 10
      : phase === "cardio"
        ? 0
        : exercise.restSeconds;

  return {
    exercise,
    phase,
    sets: setsFor(profile, phase, isDeload, adaptation),
    reps: prescription.reps,
    restSeconds:
      baseRest === 0
        ? 0
        : Math.round(baseRest * (isDeload ? 1.15 : adaptation.restFactor)),
    workSeconds:
      phase === "warmup"
        ? 60
        : phase === "cooldown"
          ? 45
          : phase === "cardio"
            ? Math.max(
                240,
                Math.min(
                  adaptation.mode === "recovery" ? 420 : 600,
                  profile.sessionMinutes * (adaptation.mode === "recovery" ? 8 : 10),
                ),
              )
            : 45,
    progressionAction: prescription.action,
    progressionNote: prescription.note,
  };
}

function pickCore(profile: UserProfile, usedSession: Set<string>, usedAcrossWeek: Set<string>) {
  return EXERCISES.filter(
    (ex) => ex.trainingRole === "core" && isEligible(ex, profile) && !usedSession.has(ex.id),
  ).sort((a, b) => {
    const aScore = goalBonus(a, profile.goals) + (usedAcrossWeek.has(a.id) ? -3 : 0);
    const bScore = goalBonus(b, profile.goals) + (usedAcrossWeek.has(b.id) ? -3 : 0);
    return bScore - aScore || a.id.localeCompare(b.id);
  })[0];
}

function pickCardio(profile: UserProfile, usedSession: Set<string>, usedAcrossWeek: Set<string>) {
  return EXERCISES.filter(
    (ex) => ex.trainingRole === "cardio" && isEligible(ex, profile) && !usedSession.has(ex.id),
  ).sort((a, b) => {
    const aScore = goalBonus(a, profile.goals) + (usedAcrossWeek.has(a.id) ? -3 : 0);
    const bScore = goalBonus(b, profile.goals) + (usedAcrossWeek.has(b.id) ? -3 : 0);
    return bScore - aScore || a.id.localeCompare(b.id);
  })[0];
}

function generateForBlueprint(
  profile: UserProfile,
  blueprint: DayBlueprint,
  dayIndex: number,
  week: number,
  usedAcrossWeek: Set<string>,
  adaptation: TrainingAdaptation,
  history: CompletedWorkout[],
): GeneratedWorkout {
  const isDeload = week % 4 === 3;
  const targetMinutes = Math.max(20, profile.sessionMinutes);
  const mainCount = Math.max(3, Math.min(5, Math.floor((targetMinutes - 10) / 5)));
  const accessoryCount = targetMinutes >= 50 ? 2 : targetMinutes >= 30 ? 1 : 0;
  const usedSession = new Set<string>();
  const result: PlannedExercise[] = [];

  for (const ex of chooseFromIds(warmupIds(blueprint), profile, usedSession, 2)) {
    result.push(planned(ex, "warmup", profile, isDeload, adaptation, history));
  }

  for (const target of blueprint.mainTargets) {
    if (result.filter((item) => item.phase === "main").length >= mainCount) break;
    const ex = chooseStrength(target, "main", profile, usedSession, usedAcrossWeek);
    if (!ex) continue;
    usedSession.add(ex.id);
    usedAcrossWeek.add(ex.id);
    result.push(planned(ex, "main", profile, isDeload, adaptation, history));
  }

  for (const target of blueprint.accessoryTargets) {
    if (result.filter((item) => item.phase === "accessory").length >= accessoryCount) break;
    const ex = chooseStrength(target, "accessory", profile, usedSession, usedAcrossWeek);
    if (!ex) continue;
    usedSession.add(ex.id);
    usedAcrossWeek.add(ex.id);
    result.push(planned(ex, "accessory", profile, isDeload, adaptation, history));
  }

  if (blueprint.includeCore && targetMinutes >= 25) {
    const core = pickCore(profile, usedSession, usedAcrossWeek);
    if (core) {
      usedSession.add(core.id);
      usedAcrossWeek.add(core.id);
      result.push(planned(core, "core", profile, isDeload, adaptation, history));
    }
  }

  const goalWantsCardio =
    profile.goals.includes("fat-loss") ||
    profile.goals.includes("endurance") ||
    profile.goals.includes("general-fitness");

  if (
    blueprint.includeCardio &&
    goalWantsCardio &&
    targetMinutes >= 35 &&
    adaptation.mode !== "recovery"
  ) {
    const cardio = pickCardio(profile, usedSession, usedAcrossWeek);
    if (cardio) {
      usedSession.add(cardio.id);
      usedAcrossWeek.add(cardio.id);
      result.push(planned(cardio, "cardio", profile, isDeload, adaptation, history));
    }
  }

  for (const ex of chooseFromIds(cooldownIds(blueprint), profile, usedSession, 2)) {
    result.push(planned(ex, "cooldown", profile, isDeload, adaptation, history));
  }

  const estimatedMinutes = Math.round(
    result.reduce(
      (sum, item) =>
        sum + item.workSeconds * item.sets + item.restSeconds * Math.max(0, item.sets - 1),
      0,
    ) / 60,
  );
  const estimatedCalories = Math.round(
    result.reduce(
      (sum, item) => sum + (item.exercise.caloriesPerMin * item.workSeconds * item.sets) / 60,
      0,
    ),
  );
  const strengthItems = result.filter((item) =>
    item.phase === "main" || item.phase === "accessory" || item.phase === "core",
  );
  const intensityBase =
    strengthItems.length === 0
      ? 35
      : strengthItems.reduce((sum, item) => sum + LEVEL_RANK[item.exercise.level] * 22, 0) /
        strengthItems.length;
  const intensity = Math.max(20, Math.min(100, Math.round(intensityBase + (isDeload ? -12 : 12))));

  return {
    id: `w-${week}-${dayIndex}-${blueprint.key}`,
    title: isDeload ? `تخفيف · ${blueprint.title}` : blueprint.title,
    splitKey: blueprint.key,
    focus: blueprint.focus,
    targetMuscles: blueprint.targetMuscles,
    exercises: result,
    estimatedMinutes,
    estimatedCalories,
    intensity:
      adaptation.mode === "recovery"
        ? Math.max(20, intensity - 10)
        : adaptation.mode === "progress"
          ? Math.min(100, intensity + 3)
          : intensity,
    isDeload,
    adaptation,
    rationale: isDeload
      ? "تم خفض المجموعات مع الحفاظ على نمط الحركة والتغطية العضلية لتسهيل الاستشفاء."
      : `جلسة ${blueprint.title} ضمن توزيع ${profile.daysPerWeek} أيام أسبوعيًا؛ تبدأ بإحماء موجه، ثم حركات أساسية، ثم مساعدة/كور، وتنتهي بتهدئة.`,
  };
}

function effectiveSetsForMuscle(
  workouts: GeneratedWorkout[],
  muscle: Muscle,
) {
  let effective = 0;
  workouts.forEach((workout) => {
    workout.exercises.forEach((item) => {
      if (
        item.phase === "warmup" ||
        item.phase === "cooldown" ||
        item.phase === "cardio"
      ) {
        return;
      }
      if (item.exercise.primary.includes(muscle)) {
        effective += item.sets;
      } else if (item.exercise.secondary.includes(muscle)) {
        effective += item.sets * 0.5;
      }
    });
  });
  return effective;
}

function tuneWeeklyVolume(
  workouts: GeneratedWorkout[],
  profile: UserProfile,
  adaptation: TrainingAdaptation,
): GeneratedWorkout[] {
  const isDeload = workouts.length > 0 && workouts.every((workout) => workout.isDeload);
  const targets = getWeeklyVolumeTargets(profile, isDeload, adaptation.mode);
  const cloned = workouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((item) => ({ ...item })),
  }));

  for (const target of targets) {
    let effective = effectiveSetsForMuscle(cloned, target.muscle);

    if (effective < target.target) {
      const candidates = cloned
        .flatMap((workout, workoutIndex) =>
          workout.exercises.map((item, exerciseIndex) => ({
            workoutIndex,
            exerciseIndex,
            item,
          })),
        )
        .filter(
          ({ item }) =>
            (item.phase === "main" ||
              item.phase === "accessory" ||
              item.phase === "core") &&
            item.exercise.primary.includes(target.muscle),
        )
        .sort((a, b) => {
          const aPriority = a.item.phase === "main" ? 0 : a.item.phase === "core" ? 1 : 2;
          const bPriority = b.item.phase === "main" ? 0 : b.item.phase === "core" ? 1 : 2;
          return aPriority - bPriority || a.item.sets - b.item.sets;
        });

      let cursor = 0;
      while (effective < target.target && candidates.length && cursor < 24) {
        const candidate = candidates[cursor % candidates.length];
        const item = cloned[candidate.workoutIndex].exercises[candidate.exerciseIndex];
        const perExerciseCap =
          item.phase === "main" ? 5 : item.phase === "core" ? 3 : 4;
        if (item.sets < perExerciseCap) {
          item.sets += 1;
          effective += 1;
        }
        cursor += 1;
      }
    }

    if (effective > target.max) {
      const candidates = cloned
        .flatMap((workout, workoutIndex) =>
          workout.exercises.map((item, exerciseIndex) => ({
            workoutIndex,
            exerciseIndex,
            item,
          })),
        )
        .filter(
          ({ item }) =>
            (item.phase === "main" ||
              item.phase === "accessory" ||
              item.phase === "core") &&
            item.exercise.primary.includes(target.muscle),
        )
        .sort((a, b) => b.item.sets - a.item.sets);

      let cursor = 0;
      while (effective > target.max && candidates.length && cursor < 24) {
        const candidate = candidates[cursor % candidates.length];
        const item = cloned[candidate.workoutIndex].exercises[candidate.exerciseIndex];
        const floor = item.phase === "main" ? 2 : 1;
        if (item.sets > floor) {
          item.sets -= 1;
          effective -= 1;
        }
        cursor += 1;
      }
    }
  }

  // Final normalization pass. A compound movement can push a muscle over
  // its cap as a secondary contributor after another muscle was tuned.
  // We may trim either direct or secondary-contributing sets, but only when
  // every affected major muscle remains at or above its weekly minimum.
  const targetByMuscle = new Map(targets.map((item) => [item.muscle, item]));

  for (let pass = 0; pass < 5; pass += 1) {
    for (const target of targets) {
      let effective = effectiveSetsForMuscle(cloned, target.muscle);
      if (effective <= target.max) continue;

      const candidates = cloned
        .flatMap((workout, workoutIndex) =>
          workout.exercises.map((item, exerciseIndex) => ({
            workoutIndex,
            exerciseIndex,
            item,
            contribution: item.exercise.primary.includes(target.muscle)
              ? 1
              : item.exercise.secondary.includes(target.muscle)
                ? 0.5
                : 0,
          })),
        )
        .filter(
          ({ item, contribution }) =>
            contribution > 0 &&
            (item.phase === "main" ||
              item.phase === "accessory" ||
              item.phase === "core"),
        )
        .sort((a, b) => {
          // Prefer trimming secondary contribution first, then larger set blocks.
          return (
            a.contribution - b.contribution ||
            b.item.sets - a.item.sets
          );
        });

      let cursor = 0;
      while (effective > target.max && cursor < candidates.length * 4) {
        const candidate = candidates[cursor % candidates.length];
        const item =
          cloned[candidate.workoutIndex].exercises[candidate.exerciseIndex];
        const floor = item.phase === "main" ? 2 : 1;

        if (item.sets > floor) {
          const affected = new Set<Muscle>([
            ...item.exercise.primary,
            ...item.exercise.secondary,
          ]);
          const keepsMinimums = Array.from(affected).every((muscle) => {
            const muscleTarget = targetByMuscle.get(muscle);
            if (!muscleTarget) return true;
            const current = effectiveSetsForMuscle(cloned, muscle);
            const decrement = item.exercise.primary.includes(muscle) ? 1 : 0.5;
            return current - decrement >= muscleTarget.min;
          });

          if (keepsMinimums) {
            item.sets -= 1;
            effective = effectiveSetsForMuscle(cloned, target.muscle);
          }
        }
        cursor += 1;
      }
    }
  }

  return cloned.map((workout) => {
    const estimatedMinutes = Math.round(
      workout.exercises.reduce(
        (sum, item) =>
          sum +
          item.workSeconds * item.sets +
          item.restSeconds * Math.max(0, item.sets - 1),
        0,
      ) / 60,
    );
    const estimatedCalories = Math.round(
      workout.exercises.reduce(
        (sum, item) =>
          sum +
          (item.exercise.caloriesPerMin * item.workSeconds * item.sets) / 60,
        0,
      ),
    );
    return { ...workout, estimatedMinutes, estimatedCalories };
  });
}

function buildWeeklyPlan(
  profile: UserProfile,
  week: number,
  history: CompletedWorkout[] = [],
) {
  const blueprints = blueprintsFor(profile.daysPerWeek);
  const usedAcrossWeek = new Set<string>();
  const adaptation = getTrainingAdaptation(profile, history);
  const base = blueprints.map((blueprint, index) =>
    generateForBlueprint(
      profile,
      blueprint,
      index,
      week,
      usedAcrossWeek,
      adaptation,
      history,
    ),
  );
  return tuneWeeklyVolume(base, profile, adaptation);
}

export function generateWeeklySchedule(
  profile: UserProfile,
  week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)),
  history: CompletedWorkout[] = [],
): WeeklyScheduleDay[] {
  const weekly = buildWeeklyPlan(profile, week, history);
  const trainingDays =
    TRAINING_DAY_PATTERNS[Math.max(1, Math.min(6, weekly.length))] ?? [0, 2, 4];
  const workoutByWeekday = new Map(
    trainingDays.map((weekday, workoutIndex) => [weekday, workoutIndex]),
  );

  return WEEKDAY_LABEL_AR.map((dayLabel, weekday) => {
    const workoutIndex = workoutByWeekday.get(weekday);
    if (workoutIndex === undefined) {
      return { weekday, dayLabel, isRest: true };
    }
    return {
      weekday,
      dayLabel,
      isRest: false,
      workoutIndex,
      workout: weekly[workoutIndex],
    };
  });
}

export function generateWorkout(
  profile: UserProfile,
  opts: { day?: number; week?: number; history?: CompletedWorkout[] } = {},
): GeneratedWorkout {
  const week = opts.week ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  const history = opts.history ?? [];
  const weekly = buildWeeklyPlan(profile, week, history);

  if (opts.day !== undefined) {
    const dayIndex = Math.max(0, Math.floor(opts.day)) % weekly.length;
    return weekly[dayIndex];
  }

  const today = new Date().getDay();
  const schedule = generateWeeklySchedule(profile, week, history);
  const todayEntry = schedule[today];
  if (todayEntry?.workout) return todayEntry.workout;

  for (let offset = 1; offset < 7; offset += 1) {
    const upcoming = schedule[(today + offset) % 7];
    if (upcoming?.workout) return upcoming.workout;
  }

  return weekly[0];
}

export function generateWeeklyPlan(
  profile: UserProfile,
  history: CompletedWorkout[] = [],
): GeneratedWorkout[] {
  const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  return buildWeeklyPlan(profile, week, history);
}

export function generateMonthlyProgram(
  profile: UserProfile,
  history: CompletedWorkout[] = [],
): GeneratedWorkout[][] {
  return Array.from({ length: 4 }, (_, week) =>
    buildWeeklyPlan(profile, week, history),
  );
}

export function getWeeklyMuscleCoverage(workouts: GeneratedWorkout[]): MuscleCoverage[] {
  const muscles = new Set<Muscle>([...MAJOR_MUSCLES, ...SMALLER_MUSCLES]);

  return Array.from(muscles).map((muscle) => {
    const days = new Set<number>();
    let directSets = 0;
    let indirectSets = 0;

    workouts.forEach((workout, dayIndex) => {
      workout.exercises.forEach((item) => {
        if (
          item.phase === "warmup" ||
          item.phase === "cooldown" ||
          item.phase === "cardio"
        ) {
          return;
        }
        if (item.exercise.primary.includes(muscle)) {
          days.add(dayIndex);
          directSets += item.sets;
        } else if (item.exercise.secondary.includes(muscle)) {
          days.add(dayIndex);
          indirectSets += item.sets;
        }
      });
    });

    return { muscle, days: days.size, directSets, indirectSets };
  });
}

export function getWeeklyVolumeStatus(
  workouts: GeneratedWorkout[],
  profile: UserProfile,
): MuscleVolumeStatus[] {
  const coverage = getWeeklyMuscleCoverage(workouts);
  const isDeload = workouts.length > 0 && workouts.every((workout) => workout.isDeload);
  const adaptationMode = workouts[0]?.adaptation.mode ?? "maintain";
  const targets = getWeeklyVolumeTargets(profile, isDeload, adaptationMode);

  return targets.map((target) => {
    const current =
      coverage.find((entry) => entry.muscle === target.muscle) ?? {
        muscle: target.muscle,
        days: 0,
        directSets: 0,
        indirectSets: 0,
      };
    const effectiveSets = Math.round(
      (current.directSets + current.indirectSets * 0.5) * 10,
    ) / 10;
    const status =
      effectiveSets < target.min
        ? "low"
        : effectiveSets > target.max
          ? "high"
          : "target";

    return {
      ...current,
      ...target,
      effectiveSets,
      status,
    };
  });
}

export function progressiveOverload(exerciseId: string, history: CompletedWorkout[]): string {
  const ex = getExercise(exerciseId);
  if (!ex) return exerciseId;
  const completions = history
    .flatMap((workout) => workout.exercises)
    .filter((item) => item.id === exerciseId && item.completed);
  if (completions.length < 2) return exerciseId;
  const index = ex.progression.indexOf(exerciseId);
  if (index === -1 || index === ex.progression.length - 1) return exerciseId;
  return ex.progression[index + 1];
}

export function scoreIntensity(workout: CompletedWorkout): number {
  const density = workout.activeSec / Math.max(1, workout.durationSec);
  return Math.round(density * 100);
}
