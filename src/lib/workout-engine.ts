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

export interface PlannedExercise {
  exercise: Exercise;
  phase: TrainingPhase;
  sets: number;
  reps: string;
  restSeconds: number;
  workSeconds: number;
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
  rationale: string;
}

export interface MuscleCoverage {
  muscle: Muscle;
  days: number;
  directSets: number;
  indirectSets: number;
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

function setsFor(profile: UserProfile, phase: TrainingPhase, isDeload: boolean) {
  if (phase === "warmup" || phase === "cooldown" || phase === "cardio") return 1;
  if (phase === "core") return isDeload ? 1 : 2;
  let sets = phase === "main" ? (profile.level === "beginner" ? 2 : 3) : profile.level === "advanced" ? 3 : 2;
  if (profile.goals.includes("muscle-gain") && phase === "main") sets += 1;
  if (profile.goals.includes("strength") && phase === "main") sets = Math.max(3, sets);
  if (isDeload) sets = Math.max(1, sets - 1);
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

function planned(exercise: Exercise, phase: TrainingPhase, profile: UserProfile, isDeload: boolean): PlannedExercise {
  return {
    exercise,
    phase,
    sets: setsFor(profile, phase, isDeload),
    reps: repsFor(exercise, profile, phase),
    restSeconds:
      phase === "warmup" || phase === "cooldown" ? 10 : phase === "cardio" ? 0 : exercise.restSeconds,
    workSeconds:
      phase === "warmup"
        ? 60
        : phase === "cooldown"
          ? 45
          : phase === "cardio"
            ? Math.max(300, Math.min(600, profile.sessionMinutes * 10))
            : 45,
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
): GeneratedWorkout {
  const isDeload = week % 4 === 3;
  const targetMinutes = Math.max(20, profile.sessionMinutes);
  const mainCount = Math.max(3, Math.min(5, Math.floor((targetMinutes - 10) / 5)));
  const accessoryCount = targetMinutes >= 50 ? 2 : targetMinutes >= 30 ? 1 : 0;
  const usedSession = new Set<string>();
  const result: PlannedExercise[] = [];

  for (const ex of chooseFromIds(warmupIds(blueprint), profile, usedSession, 2)) {
    result.push(planned(ex, "warmup", profile, isDeload));
  }

  for (const target of blueprint.mainTargets) {
    if (result.filter((item) => item.phase === "main").length >= mainCount) break;
    const ex = chooseStrength(target, "main", profile, usedSession, usedAcrossWeek);
    if (!ex) continue;
    usedSession.add(ex.id);
    usedAcrossWeek.add(ex.id);
    result.push(planned(ex, "main", profile, isDeload));
  }

  for (const target of blueprint.accessoryTargets) {
    if (result.filter((item) => item.phase === "accessory").length >= accessoryCount) break;
    const ex = chooseStrength(target, "accessory", profile, usedSession, usedAcrossWeek);
    if (!ex) continue;
    usedSession.add(ex.id);
    usedAcrossWeek.add(ex.id);
    result.push(planned(ex, "accessory", profile, isDeload));
  }

  if (blueprint.includeCore && targetMinutes >= 25) {
    const core = pickCore(profile, usedSession, usedAcrossWeek);
    if (core) {
      usedSession.add(core.id);
      usedAcrossWeek.add(core.id);
      result.push(planned(core, "core", profile, isDeload));
    }
  }

  const goalWantsCardio =
    profile.goals.includes("fat-loss") ||
    profile.goals.includes("endurance") ||
    profile.goals.includes("general-fitness");

  if (blueprint.includeCardio && goalWantsCardio && targetMinutes >= 35) {
    const cardio = pickCardio(profile, usedSession, usedAcrossWeek);
    if (cardio) {
      usedSession.add(cardio.id);
      usedAcrossWeek.add(cardio.id);
      result.push(planned(cardio, "cardio", profile, isDeload));
    }
  }

  for (const ex of chooseFromIds(cooldownIds(blueprint), profile, usedSession, 2)) {
    result.push(planned(ex, "cooldown", profile, isDeload));
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
    intensity,
    isDeload,
    rationale: isDeload
      ? "تم خفض المجموعات مع الحفاظ على نمط الحركة والتغطية العضلية لتسهيل الاستشفاء."
      : `جلسة ${blueprint.title} ضمن توزيع ${profile.daysPerWeek} أيام أسبوعيًا؛ تبدأ بإحماء موجه، ثم حركات أساسية، ثم مساعدة/كور، وتنتهي بتهدئة.`,
  };
}

export function generateWorkout(
  profile: UserProfile,
  opts: { day?: number; week?: number } = {},
): GeneratedWorkout {
  const blueprints = blueprintsFor(profile.daysPerWeek);
  const weekdayIndex = (new Date().getDay() + 6) % 7;
  const dayIndex =
    opts.day === undefined
      ? weekdayIndex % blueprints.length
      : Math.max(0, Math.floor(opts.day)) % blueprints.length;
  const week = opts.week ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  return generateForBlueprint(profile, blueprints[dayIndex], dayIndex, week, new Set<string>());
}

export function generateWeeklyPlan(profile: UserProfile): GeneratedWorkout[] {
  const blueprints = blueprintsFor(profile.daysPerWeek);
  const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  const usedAcrossWeek = new Set<string>();
  return blueprints.map((blueprint, index) =>
    generateForBlueprint(profile, blueprint, index, week, usedAcrossWeek),
  );
}

export function generateMonthlyProgram(profile: UserProfile): GeneratedWorkout[][] {
  const blueprints = blueprintsFor(profile.daysPerWeek);
  return Array.from({ length: 4 }, (_, week) => {
    const usedAcrossWeek = new Set<string>();
    return blueprints.map((blueprint, day) =>
      generateForBlueprint(profile, blueprint, day, week, usedAcrossWeek),
    );
  });
}

export function getWeeklyMuscleCoverage(workouts: GeneratedWorkout[]): MuscleCoverage[] {
  const muscles = new Set<Muscle>([
    ...MAJOR_MUSCLES,
    "biceps",
    "triceps",
    "calves",
    "forearms",
  ]);

  return Array.from(muscles).map((muscle) => {
    const days = new Set<number>();
    let directSets = 0;
    let indirectSets = 0;

    workouts.forEach((workout, dayIndex) => {
      workout.exercises.forEach((item) => {
        if (item.phase === "warmup" || item.phase === "cooldown" || item.phase === "cardio") return;
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
