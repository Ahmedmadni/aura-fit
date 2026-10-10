import {
  DEFAULT_PROFILE,
  MAX_LOCAL_READINESS,
  MAX_LOCAL_WORKOUTS,
  loadHistory,
  loadProfile,
  loadProfileUpdatedAt,
  loadReadinessHistory,
  normalizeReadinessCheckIn,
  replaceLocalHistory,
  replaceLocalProfile,
  replaceLocalReadinessHistory,
  type CompletedWorkout,
  type DailyReadinessCheckIn,
  type UserProfile,
} from "./user-profile";

const BACKUP_FORMAT = "aura-fit-local-backup";
const BACKUP_VERSION = 1 as const;

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const GOALS = new Set([
  "fat-loss",
  "muscle-gain",
  "strength",
  "endurance",
  "mobility",
  "general-fitness",
]);
const EQUIPMENT = new Set([
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
]);
const INJURIES = new Set([
  "knee",
  "lower-back",
  "shoulder",
  "wrist",
  "ankle",
  "neck",
  "hip",
]);

export interface AuraLocalBackupV1 {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profileUpdatedAt: string | null;
  profile: UserProfile;
  readiness: DailyReadinessCheckIn[];
  workouts: CompletedWorkout[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validIso(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(new Date(value).getTime())
  );
}

function stringArrayFromSet(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string" && allowed.has(item))) {
    return null;
  }
  return value as string[];
}

function validateProfile(value: unknown): UserProfile {
  if (!isRecord(value)) throw new Error("ملف المستخدم داخل النسخة غير صالح.");

  const level = typeof value.level === "string" ? value.level : "";
  if (!LEVELS.has(level)) throw new Error("مستوى التدريب في النسخة غير صالح.");

  const goals = stringArrayFromSet(value.goals, GOALS);
  const equipment = stringArrayFromSet(value.equipment, EQUIPMENT);
  const injuries = stringArrayFromSet(value.injuries, INJURIES);
  if (!goals || !equipment || !injuries) {
    throw new Error("الأهداف أو المعدات أو قيود الحركة في النسخة غير صالحة.");
  }

  const daysPerWeek = value.daysPerWeek;
  const sessionMinutes = value.sessionMinutes;
  const sleepQuality = value.sleepQuality;
  const fatigue = value.fatigue;
  if (
    !finiteNumber(daysPerWeek) ||
    daysPerWeek < 1 ||
    daysPerWeek > 7 ||
    !finiteNumber(sessionMinutes) ||
    sessionMinutes < 10 ||
    sessionMinutes > 180 ||
    !finiteNumber(sleepQuality) ||
    sleepQuality < 1 ||
    sleepQuality > 5 ||
    !finiteNumber(fatigue) ||
    fatigue < 1 ||
    fatigue > 5
  ) {
    throw new Error("إعدادات الجدول أو الجاهزية الأساسية في النسخة غير صالحة.");
  }

  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    name: typeof value.name === "string" ? value.name.slice(0, 120) : undefined,
    level: level as UserProfile["level"],
    goals: goals as UserProfile["goals"],
    equipment: equipment as UserProfile["equipment"],
    injuries: injuries as UserProfile["injuries"],
    daysPerWeek: Math.round(daysPerWeek),
    sessionMinutes: Math.round(sessionMinutes),
    sleepQuality: Math.round(sleepQuality),
    fatigue: Math.round(fatigue),
  };

  if (finiteNumber(value.age) && value.age >= 13 && value.age <= 120) {
    profile.age = Math.round(value.age);
  }
  if (finiteNumber(value.weightKg) && value.weightKg > 20 && value.weightKg < 400) {
    profile.weightKg = value.weightKg;
  }
  if (finiteNumber(value.heightCm) && value.heightCm > 100 && value.heightCm < 260) {
    profile.heightCm = value.heightCm;
  }
  if (value.gender === "male" || value.gender === "female") {
    profile.gender = value.gender;
  }

  return profile;
}

function numberArray(value: unknown, min: number, max: number) {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) => finiteNumber(item) && item >= min && item <= max,
    )
  ) {
    throw new Error("بيانات المجموعات داخل سجل التمرين غير صالحة.");
  }
  return value as number[];
}

function validateWorkout(value: unknown): CompletedWorkout {
  if (!isRecord(value)) throw new Error("جلسة تدريب في النسخة غير صالحة.");
  if (
    typeof value.id !== "string" ||
    !value.id ||
    !validIso(value.date) ||
    !Array.isArray(value.exercises) ||
    !finiteNumber(value.durationSec) ||
    !finiteNumber(value.activeSec) ||
    !finiteNumber(value.calories) ||
    !finiteNumber(value.intensity) ||
    !finiteNumber(value.performance)
  ) {
    throw new Error("بيانات جلسة تدريب في النسخة غير مكتملة.");
  }

  const exercises = value.exercises.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !item.id ||
      !finiteNumber(item.sets) ||
      item.sets < 0 ||
      item.sets > 30 ||
      typeof item.reps !== "string" ||
      typeof item.completed !== "boolean"
    ) {
      throw new Error("تفاصيل تمرين داخل النسخة غير صالحة.");
    }

    const progressionAction: CompletedWorkout["exercises"][number]["progressionAction"] =
      item.progressionAction === "build-reps" ||
      item.progressionAction === "increase-load" ||
      item.progressionAction === "hold" ||
      item.progressionAction === "reduce"
        ? item.progressionAction
        : undefined;
    const rotationReason: CompletedWorkout["exercises"][number]["rotationReason"] =
      item.rotationReason === "mesocycle" || item.rotationReason === "plateau"
        ? item.rotationReason
        : undefined;

    return {
      id: item.id,
      sets: Math.round(item.sets),
      reps: item.reps.slice(0, 80),
      completed: item.completed,
      setReps: numberArray(item.setReps, 0, 1000),
      setLoadsKg: numberArray(item.setLoadsKg, 0, 1000),
      setRir: numberArray(item.setRir, 0, 5),
      setRpe: numberArray(item.setRpe, 0, 10),
      progressionAction,
      rotatedFromId:
        typeof item.rotatedFromId === "string" ? item.rotatedFromId : undefined,
      rotationReason,
    };
  });

  return {
    id: value.id,
    date: value.date,
    exercises,
    durationSec: Math.max(0, Math.round(value.durationSec)),
    activeSec: Math.max(0, Math.round(value.activeSec)),
    calories: Math.max(0, Math.round(value.calories)),
    intensity: Math.max(0, Math.min(100, Math.round(value.intensity))),
    performance: Math.max(0, Math.min(100, Math.round(value.performance))),
    adaptationMode:
      value.adaptationMode === "progress" ||
      value.adaptationMode === "maintain" ||
      value.adaptationMode === "recovery"
        ? value.adaptationMode
        : undefined,
    readinessScore: finiteNumber(value.readinessScore)
      ? Math.max(0, Math.min(100, Math.round(value.readinessScore)))
      : undefined,
    periodizationPhase:
      value.periodizationPhase === "accumulation" ||
      value.periodizationPhase === "progression" ||
      value.periodizationPhase === "intensification" ||
      value.periodizationPhase === "deload"
        ? value.periodizationPhase
        : undefined,
    periodizationCycleWeek:
      value.periodizationCycleWeek === 1 ||
      value.periodizationCycleWeek === 2 ||
      value.periodizationCycleWeek === 3 ||
      value.periodizationCycleWeek === 4
        ? value.periodizationCycleWeek
        : undefined,
  };
}

function validateReadiness(value: unknown): DailyReadinessCheckIn {
  if (
    !isRecord(value) ||
    typeof value.dateKey !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) ||
    !validIso(value.recordedAt) ||
    !finiteNumber(value.sleepQuality) ||
    !finiteNumber(value.fatigue) ||
    !finiteNumber(value.muscleSoreness) ||
    !finiteNumber(value.energy)
  ) {
    throw new Error("تقييم جاهزية داخل النسخة غير صالح.");
  }
  return normalizeReadinessCheckIn(value as unknown as DailyReadinessCheckIn);
}

export function createLocalBackup(): AuraLocalBackupV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profileUpdatedAt: loadProfileUpdatedAt(),
    profile: loadProfile(),
    readiness: loadReadinessHistory(),
    workouts: loadHistory(),
  };
}

export function serializeLocalBackup() {
  return JSON.stringify(createLocalBackup(), null, 2);
}

export function parseLocalBackup(text: string): AuraLocalBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("الملف ليس JSON صالحًا.");
  }

  if (!isRecord(parsed)) throw new Error("صيغة النسخة الاحتياطية غير صالحة.");
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    throw new Error("هذا الملف ليس نسخة Aura Fit مدعومة.");
  }
  if (!validIso(parsed.exportedAt)) {
    throw new Error("تاريخ تصدير النسخة غير صالح.");
  }
  if (
    parsed.profileUpdatedAt !== null &&
    !validIso(parsed.profileUpdatedAt)
  ) {
    throw new Error("تاريخ تحديث الملف الشخصي غير صالح.");
  }
  if (!Array.isArray(parsed.readiness) || !Array.isArray(parsed.workouts)) {
    throw new Error("سجل الجاهزية أو الجلسات داخل النسخة غير صالح.");
  }
  if (parsed.readiness.length > 500 || parsed.workouts.length > 2000) {
    throw new Error("حجم النسخة الاحتياطية غير منطقي.");
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    profileUpdatedAt: parsed.profileUpdatedAt as string | null,
    profile: validateProfile(parsed.profile),
    readiness: parsed.readiness.map(validateReadiness),
    workouts: parsed.workouts.map(validateWorkout),
  };
}

export function restoreLocalBackup(text: string) {
  const backup = parseLocalBackup(text);
  const restoredAt = backup.profileUpdatedAt ?? new Date().toISOString();

  replaceLocalProfile(backup.profile, restoredAt, false);
  replaceLocalReadinessHistory(backup.readiness, false);
  replaceLocalHistory(backup.workouts, false);

  return {
    profile: backup.profile,
    readiness: Math.min(MAX_LOCAL_READINESS, backup.readiness.length),
    workouts: Math.min(MAX_LOCAL_WORKOUTS, backup.workouts.length),
    exportedAt: backup.exportedAt,
  };
}
