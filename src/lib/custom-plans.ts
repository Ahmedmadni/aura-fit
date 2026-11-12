import { getExercise, type Category, type Exercise, type Muscle } from "./exercise-db";
import {
  generateWorkout,
  getExerciseProgressionPrescription,
  hasEquipment,
  isSafeFor,
  type GeneratedWorkout,
  type PlannedExercise,
  type TrainingPhase,
} from "./workout-engine";
import type { CompletedWorkout, UserProfile } from "./user-profile";

export const CUSTOM_PLANS_KEY = "kp.customPlans";
const MAX_PLANS = 20;
const MAX_SLOTS = 40;

export interface CustomPlanSlot {
  id: string;
  sets: number;
  reps: string;
  rest: number;
}
export interface CustomPlan {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  slots: CustomPlanSlot[];
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSlot(value: unknown): CustomPlanSlot | null {
  if (!record(value) || typeof value.id !== "string" || !getExercise(value.id)) return null;
  if (typeof value.sets !== "number" || !Number.isInteger(value.sets) || value.sets < 1 || value.sets > 8) return null;
  if (typeof value.reps !== "string" || !value.reps.trim() || value.reps.length > 80) return null;
  if (typeof value.rest !== "number" || !Number.isInteger(value.rest) || value.rest < 0 || value.rest > 300) return null;
  return { id: value.id, sets: value.sets as number, reps: value.reps.trim(), rest: value.rest as number };
}

function readPlan(value: unknown): CustomPlan | null {
  if (!record(value) || typeof value.id !== "string" ||
      !/^plan-[a-zA-Z0-9-]{1,100}$/.test(value.id) ||
      typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
      !Array.isArray(value.slots) || !value.slots.length || value.slots.length > MAX_SLOTS) return null;
  const slots = value.slots.map(readSlot);
  if (slots.some((slot) => !slot)) return null;
  const valid = slots as CustomPlanSlot[];
  // Completed workout history is keyed by exercise ID: duplicate IDs cannot be recorded safely.
  if (new Set(valid.map((slot) => slot.id)).size !== valid.length) return null;
  const title = typeof value.title === "string" && value.title.trim()
    ? value.title.trim().slice(0, 80) : "خطة مخصصة";
  const updatedAt = typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : value.createdAt;
  return { id: value.id, title, createdAt: value.createdAt, updatedAt, slots: valid };
}

export function normalizeCustomPlans(value: unknown): CustomPlan[] {
  if (!Array.isArray(value) || value.length > MAX_PLANS) {
    throw new Error("قائمة الخطط المحفوظة غير صالحة.");
  }
  const plans = value.map(readPlan);
  if (plans.some((plan) => !plan)) {
    throw new Error("هناك خطة محفوظة تحتوي بيانات أو تمارين غير صالحة.");
  }
  const valid = plans as CustomPlan[];
  if (new Set(valid.map((plan) => plan.id)).size !== valid.length) {
    throw new Error("هناك معرف خطة مكرر.");
  }
  return valid;
}

export function loadCustomPlans(): CustomPlan[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(CUSTOM_PLANS_KEY);
  if (!raw) return [];
  // Corrupt data are never overwritten silently; the builder shows an error.
  return normalizeCustomPlans(JSON.parse(raw) as unknown);
}

export function getCustomPlan(id: string): CustomPlan | undefined {
  return loadCustomPlans().find((plan) => plan.id === id);
}

export function replaceCustomPlans(value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_PLANS_KEY, JSON.stringify(normalizeCustomPlans(value)));
}

export function saveCustomPlan(input: { id?: string; title?: string; slots: CustomPlanSlot[] }): CustomPlan {
  if (typeof window === "undefined") throw new Error("التخزين غير متاح.");
  const current = loadCustomPlans();
  const previous = input.id ? current.find((plan) => plan.id === input.id) : undefined;
  if (input.id && !previous) throw new Error("تعذر العثور على الخطة لتحديثها.");
  const now = new Date().toISOString();
  const id = previous?.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const candidate = readPlan({
    id, title: input.title?.trim() || previous?.title || "خطة مخصصة",
    createdAt: previous?.createdAt ?? now, updatedAt: now, slots: input.slots,
  });
  if (!candidate) throw new Error("راجع التمارين والتكرارات: لا يمكن حفظ تمرين مكرر أو بيانات غير صالحة.");
  const updated = [candidate, ...current.filter((plan) => plan.id !== id)].slice(0, MAX_PLANS);
  localStorage.setItem(CUSTOM_PLANS_KEY, JSON.stringify(updated));
  return candidate;
}

export function deleteCustomPlan(id: string) {
  if (typeof window === "undefined") return;
  const current = loadCustomPlans();
  localStorage.setItem(CUSTOM_PLANS_KEY, JSON.stringify(current.filter((plan) => plan.id !== id)));
}

export function getCustomPlanSafetyErrors(plan: CustomPlan, profile: UserProfile): string[] {
  const errors: string[] = [];
  for (const slot of plan.slots) {
    const exercise = getExercise(slot.id);
    if (!exercise) {
      errors.push(`التمرين ${slot.id} غير موجود في المكتبة.`);
    } else if (!hasEquipment(exercise, profile.equipment)) {
      errors.push(`${exercise.name}: المعدات غير متاحة في ملفك.`);
    } else if (!isSafeFor(exercise, profile.injuries)) {
      errors.push(`${exercise.name}: يتعارض مع القيود المسجلة في ملفك.`);
    }
  }
  return errors;
}

function phaseFor(exercise: Exercise): TrainingPhase {
  return exercise.trainingRole === "mobility" ? "cooldown" : exercise.trainingRole;
}

export function createCustomWorkout(
  plan: CustomPlan,
  profile: UserProfile,
  history: CompletedWorkout[],
  baseline: GeneratedWorkout,
): GeneratedWorkout {
  const problems = getCustomPlanSafetyErrors(plan, profile);
  if (problems.length) throw new Error(problems.join(" | "));
  const items: PlannedExercise[] = plan.slots.map((slot) => {
    const exercise = getExercise(slot.id)!;
    const phase = phaseFor(exercise);
    const prescription = getExerciseProgressionPrescription(
      exercise.id, slot.reps, history, baseline.adaptation.mode,
    );
    const workSeconds = phase === "warmup" ? 60 :
      phase === "cooldown" ? 45 :
      phase === "cardio" ? 300 : 45;
    return {
      exercise, phase, sets: slot.sets, reps: slot.reps, restSeconds: slot.rest, workSeconds,
      progressionAction: prescription.action, progressionNote: prescription.note,
      trackLoad: prescription.trackLoad, lastLoadKg: prescription.lastLoadKg,
      suggestedLoadKg: prescription.suggestedLoadKg, loadStepKg: prescription.loadStepKg,
      targetRir: prescription.targetRir,
    };
  });
  const totalSeconds = items.reduce(
    (sum, item) => sum + item.workSeconds * item.sets +
      item.restSeconds * Math.max(0, item.sets - 1), 0,
  );
  const muscles = new Set<Muscle>();
  const focus = new Set<Category>();
  for (const item of items) {
    item.exercise.primary.forEach((muscle) => muscles.add(muscle));
    focus.add(item.exercise.category);
  }
  return {
    ...baseline,
    id: `custom:${plan.id}:${plan.updatedAt}`,
    title: plan.title,
    splitKey: "custom",
    focus: [...focus],
    targetMuscles: [...muscles],
    exercises: items,
    estimatedMinutes: Math.round(totalSeconds / 60),
    estimatedCalories: Math.round(items.reduce(
      (sum, item) => sum + item.exercise.caloriesPerMin * item.workSeconds * item.sets / 60, 0,
    )),
    safetyAdjusted: false,
    rationale: "جلسة مخصصة أنشأتها بنفسك. روجعت المعدات والقيود المسجلة قبل بدء التنفيذ.",
  };
}
