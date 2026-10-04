import {
  loadHistory,
  loadProfile,
  loadReadinessHistory,
  replaceLocalHistory,
  replaceLocalProfile,
  replaceLocalReadinessHistory,
} from "../src/lib/user-profile";
import {
  parseLocalBackup,
  restoreLocalBackup,
  serializeLocalBackup,
} from "../src/lib/local-backup";

class MemoryStorage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear() {
    this.data.clear();
  }

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: globalThis,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

const profileUpdatedAt = "2026-10-04T10:00:00.000Z";
replaceLocalProfile(
  {
    name: "Backup Test",
    level: "intermediate",
    goals: ["muscle-gain"],
    equipment: ["none", "mat", "dumbbells"],
    injuries: ["knee"],
    daysPerWeek: 4,
    sessionMinutes: 45,
    sleepQuality: 4,
    fatigue: 2,
    age: 32,
    weightKg: 80,
    heightCm: 178,
    gender: "male",
  },
  profileUpdatedAt,
  false,
);

replaceLocalReadinessHistory(
  [
    {
      dateKey: "2026-10-04",
      recordedAt: "2026-10-04T09:00:00.000Z",
      sleepQuality: 5,
      fatigue: 2,
      muscleSoreness: 2,
      energy: 5,
    },
  ],
  false,
);

replaceLocalHistory(
  [
    {
      id: "backup-workout-1",
      date: "2026-10-04T08:00:00.000Z",
      exercises: [
        {
          id: "bench-press",
          sets: 3,
          reps: "8-12",
          completed: true,
          setReps: [10, 10, 9],
          setLoadsKg: [70, 70, 70],
          setRir: [2, 2, 1],
          setRpe: [8, 8, 9],
          progressionAction: "hold",
        },
      ],
      durationSec: 2700,
      activeSec: 1800,
      calories: 250,
      intensity: 75,
      performance: 92,
      adaptationMode: "maintain",
      readinessScore: 82,
      periodizationPhase: "progression",
      periodizationCycleWeek: 2,
    },
  ],
  false,
);

localStorage.setItem(
  "kp.cloud.session",
  JSON.stringify({
    access_token: "SECRET_ACCESS_TOKEN",
    refresh_token: "SECRET_REFRESH_TOKEN",
  }),
);

const serialized = serializeLocalBackup();
if (
  serialized.includes("SECRET_ACCESS_TOKEN") ||
  serialized.includes("SECRET_REFRESH_TOKEN") ||
  serialized.includes("kp.cloud.session")
) {
  throw new Error("Cloud credentials leaked into the local backup.");
}

const parsed = parseLocalBackup(serialized);
if (
  parsed.profile.name !== "Backup Test" ||
  parsed.readiness.length !== 1 ||
  parsed.workouts.length !== 1
) {
  throw new Error("Backup payload did not include the expected local data.");
}

localStorage.clear();
localStorage.setItem("kp.cloud.session", "KEEP_EXISTING_SESSION");
const restored = restoreLocalBackup(serialized);

if (localStorage.getItem("kp.cloud.session") !== "KEEP_EXISTING_SESSION") {
  throw new Error("Restoring a local backup changed the cloud auth session.");
}
if (loadProfile().name !== "Backup Test") {
  throw new Error("Profile was not restored.");
}
if (loadReadinessHistory()[0]?.energy !== 5) {
  throw new Error("Readiness history was not restored.");
}
if (loadHistory()[0]?.id !== "backup-workout-1") {
  throw new Error("Workout history was not restored.");
}
if (restored.workouts !== 1 || restored.readiness !== 1) {
  throw new Error("Restore summary counts are incorrect.");
}

let rejected = false;
try {
  parseLocalBackup(
    JSON.stringify({
      ...parsed,
      version: 999,
    }),
  );
} catch {
  rejected = true;
}
if (!rejected) {
  throw new Error("Unsupported backup versions must be rejected.");
}

console.log(
  "Local backup PASS: profile, readiness and workouts round-trip without exporting or replacing cloud credentials.",
);
