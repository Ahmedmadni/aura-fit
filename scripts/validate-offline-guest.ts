/**
 * Offline guest contract: no network, cloud configuration, or login required.
 * This is a unit/integration test for locally persisted training data, not
 * proof that a fresh TWA install can boot offline before caching the web shell.
 */
import {
  loadHistory, loadProfile, loadReadinessHistory, loadTodayReadiness,
  readinessDateKey, recordWorkout, saveDailyReadiness, saveProfile,
} from "../src/lib/user-profile";
import {
  getCustomPlan, loadCustomPlans, saveCustomPlan, createCustomWorkout,
} from "../src/lib/custom-plans";
import { generateWorkout } from "../src/lib/workout-engine";
import { serializeLocalBackup, parseLocalBackup } from "../src/lib/local-backup";
import {
  getWorkoutSessionSafetySignature,
  loadRecoverableWorkoutSessionDraft,
  saveWorkoutSessionDraft,
} from "../src/lib/workout-session";

const data = new Map<string, string>();
const store = {
  get length() { return data.size; },
  getItem(key: string) { return data.get(key) ?? null; },
  setItem(key: string, value: string) { data.set(key, String(value)); },
  removeItem(key: string) { data.delete(key); },
  clear() { data.clear(); },
  key(index: number) { return [...data.keys()][index] ?? null; },
};
Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
let networkAttempts = 0;
(globalThis as any).fetch = async () => {
  networkAttempts++;
  throw new Error("Local-first guest test must not request any remote service.");
};
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error("Offline guest regression: " + message);
};
check(localStorage.getItem("kp.cloud.session") === null, "guest must not have login session");
saveProfile({
  name: "Offline Guest", level: "beginner", daysPerWeek: 3,
  sessionMinutes: 30, equipment: ["none", "mat"], injuries: [],
});
const profile = loadProfile();
check(profile.name === "Offline Guest", "profile save without login failed");

const dateKey = readinessDateKey();
const checkIn = saveDailyReadiness({
  dateKey, energy: 4, fatigue: 2, muscleSoreness: 2, sleepQuality: 4,
});
check(checkIn?.dateKey === dateKey && loadTodayReadiness()?.energy === 4, "offline check-in failed");

const workout = generateWorkout(profile, { history: [], readiness: loadTodayReadiness() });
check(workout.exercises.length > 0, "training generator requires network/login");
const first = workout.exercises[0];
const custom = saveCustomPlan({
  title: "Guest Offline Plan",
  slots: [{
    id: first.exercise.id, sets: first.sets, reps: first.reps,
    rest: Math.min(300, first.restSeconds),
  }],
});
const selected = getCustomPlan(custom.id);
check(selected?.title === "Guest Offline Plan" && loadCustomPlans().length === 1,
  "custom plan not stored on the device");
const active = createCustomWorkout(selected!, profile, [], workout);
check(active.exercises.length === 1 && active.exercises[0].exercise.id === first.exercise.id,
  "offline custom workout selected the wrong exercise");

saveWorkoutSessionDraft({
  workoutId: active.id, day: null,
  safetySignature: getWorkoutSessionSafetySignature(profile),
  plan: active.exercises, index: 0, setIdx: 1, phase: "work",
  remaining: 30, completed: [], skipped: [],
  setReps: {}, setLoadsKg: {}, setRir: {},
  currentReps: 8, currentLoadKg: 0, currentRir: null,
  elapsed: 0, muted: true,
});
const recovered = loadRecoverableWorkoutSessionDraft();
check(recovered?.workoutId === active.id && recovered.plan.length === 1,
  "interrupted guest workout not restorable offline");

recordWorkout({
  id: "guest-offline-complete",
  date: new Date().toISOString(),
  exercises: [{
    id: first.exercise.id, sets: 1, reps: "8", completed: true,
    setReps: [8], setRir: [2],
  }],
  durationSec: 180, activeSec: 80, calories: 20, intensity: 50, performance: 100,
});
check(loadHistory()[0]?.id === "guest-offline-complete", "offline progress history lost");
check(loadReadinessHistory().length === 1, "local readiness history lost");
const backup = parseLocalBackup(serializeLocalBackup());
check(backup.profile.name === "Offline Guest" &&
  backup.workouts[0].id === "guest-offline-complete" &&
  backup.customPlans?.[0].id === custom.id,
  "local backup omitted guest data");
check(networkAttempts === 0, "offline guest tried to access a remote API");
check(localStorage.getItem("kp.cloud.session") === null,
  "guest flow unexpectedly required or created a cloud session");

console.log("Offline guest PASS: no account/network, local profile, check-in, plan generation, custom workout, draft recovery, progress and backup.");
