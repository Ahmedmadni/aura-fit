import { EXERCISES } from "../src/lib/exercise-db";
import {
  CUSTOM_PLANS_KEY, createCustomWorkout, deleteCustomPlan, getCustomPlan,
  getCustomPlanSafetyErrors, loadCustomPlans, normalizeCustomPlans,
  saveCustomPlan,
} from "../src/lib/custom-plans";
import { generateWorkout, hasEquipment, isSafeFor } from "../src/lib/workout-engine";
import type { UserProfile } from "../src/lib/user-profile";

const values = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error("Custom plan regression: " + message);
};
const profile: UserProfile = {
  level: "intermediate", goals: ["general-fitness"], equipment: ["none", "mat"],
  injuries: [], daysPerWeek: 3, sessionMinutes: 30, sleepQuality: 4, fatigue: 2,
};
const safe = EXERCISES.find((ex) => hasEquipment(ex, profile.equipment) && isSafeFor(ex, []));
const unsafe = EXERCISES.find((ex) => !hasEquipment(ex, profile.equipment));
assert(safe && unsafe, "test needs safe and equipment-restricted catalog exercises");
const slot = { id: safe!.id, sets: 3, reps: "8-12", rest: 90 };

const saved = saveCustomPlan({ title: "اختبار خطتي", slots: [slot] });
assert(getCustomPlan(saved.id)?.title === "اختبار خطتي", "save/read round-trip");
assert(loadCustomPlans().length === 1, "new plan count");
assert(saved.slots[0].sets === 3 && saved.slots[0].rest === 90, "custom prescription preserved");
const baseline = generateWorkout(profile, { history: [] });
const actual = createCustomWorkout(saved, profile, [], baseline);
assert(actual.id.startsWith("custom:" + saved.id + ":"), "stable custom source ID");
assert(actual.exercises.length === 1, "custom workout did not replace generated exercise list");
assert(actual.exercises[0].exercise.id === safe!.id, "wrong exercise launched");
assert(actual.exercises[0].sets === 3 && actual.exercises[0].reps === "8-12" &&
  actual.exercises[0].restSeconds === 90, "sets, reps, rest not forwarded to active session");
assert(actual.adaptation.mode === baseline.adaptation.mode, "adaptive context was discarded");

const edited = saveCustomPlan({ id: saved.id, title: "الخطة الجديدة", slots: [{ ...slot, sets: 2 }] });
assert(loadCustomPlans().length === 1 && getCustomPlan(saved.id)?.slots[0].sets === 2, "edit made duplicate or lost changes");
assert(edited.createdAt === saved.createdAt, "plan creation timestamp changed");
const oldFormat = [{ id: "plan-1234", createdAt: saved.createdAt, slots: [slot] }];
assert(normalizeCustomPlans(oldFormat)[0].title === "خطة مخصصة", "legacy builder plan incompatible");
assert(getCustomPlanSafetyErrors({ ...saved, slots: [{ ...slot, id: unsafe!.id }] }, profile).length > 0,
  "missing equipment must prevent unsafe launch");
let rejected = false;
try { createCustomWorkout({ ...saved, slots: [{ ...slot, id: unsafe!.id }] }, profile, [], baseline); }
catch { rejected = true; }
assert(rejected, "unsafe custom session was launched");
for (const invalid of [
  [{ ...saved, slots: [slot, slot] }],
  [{ ...saved, slots: [{ ...slot, sets: 0 }] }],
  [{ ...saved, slots: [{ ...slot, reps: "" }] }],
  [{ ...saved, slots: [{ ...slot, id: "nonexistent-exercise" }] }],
]) {
  let failed = false;
  try { normalizeCustomPlans(invalid); } catch { failed = true; }
  assert(failed, "corrupt or duplicate plan was accepted");
}
values.set(CUSTOM_PLANS_KEY, "{damaged");
rejected = false;
try { saveCustomPlan({ title: "overwrite", slots: [slot] }); } catch { rejected = true; }
assert(rejected && values.get(CUSTOM_PLANS_KEY) === "{damaged", "corrupt existing plans overwritten");
values.set(CUSTOM_PLANS_KEY, JSON.stringify([saved]));
deleteCustomPlan(saved.id);
assert(loadCustomPlans().length === 0, "delete did not remove plan");
console.log("Custom plans PASS: save, legacy load, edit, active launch, safety rejection, corruption guard and delete.");
