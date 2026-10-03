import { getCloudConfig } from "./cloud-config";
import {
  getValidCloudSession,
  loadCloudSession,
  type CloudSession,
} from "./cloud-auth";
import {
  loadHistory,
  loadProfile,
  loadProfileUpdatedAt,
  loadReadinessHistory,
  replaceLocalHistory,
  replaceLocalProfile,
  replaceLocalReadinessHistory,
  type CompletedWorkout,
  type DailyReadinessCheckIn,
  type LocalDataChange,
  type UserProfile,
} from "./user-profile";

export const CLOUD_SYNC_STATUS_EVENT = "aura:cloud-sync-status";

export type CloudSyncStatus =
  | { state: "idle"; message: string }
  | { state: "syncing"; message: string }
  | { state: "synced"; message: string; syncedAt: string }
  | { state: "error"; message: string };

type ProfileRow = {
  user_id: string;
  data: UserProfile;
  client_updated_at: string;
  updated_at?: string;
};

type ReadinessRow = {
  user_id: string;
  date_key: string;
  data: DailyReadinessCheckIn;
  recorded_at: string;
  updated_at?: string;
};

type WorkoutRow = {
  user_id: string;
  workout_id: string;
  workout_date: string;
  data: CompletedWorkout;
  updated_at?: string;
};

function emitStatus(status: CloudSyncStatus) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CloudSyncStatus>(CLOUD_SYNC_STATUS_EVENT, {
      detail: status,
    }),
  );
}

function apiHeaders(session: CloudSession, prefer?: string) {
  const config = getCloudConfig();
  if (!config) throw new Error("Cloud sync is not configured.");
  return {
    apikey: config.key,
    Authorization: "Bearer " + session.access_token,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function cloudRequest<T>(
  path: string,
  session: CloudSession,
  init: RequestInit = {},
): Promise<T> {
  const config = getCloudConfig();
  if (!config) throw new Error("Cloud sync is not configured.");

  const response = await fetch(config.url + "/rest/v1/" + path, {
    ...init,
    headers: {
      ...apiHeaders(session),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      "Cloud sync request failed (" +
        response.status +
        "): " +
        body.slice(0, 300),
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function mergeHistory(
  local: CompletedWorkout[],
  cloud: CompletedWorkout[],
) {
  const byId = new Map<string, CompletedWorkout>();
  for (const workout of [...cloud, ...local]) {
    const current = byId.get(workout.id);
    if (
      !current ||
      new Date(workout.date).getTime() >= new Date(current.date).getTime()
    ) {
      byId.set(workout.id, workout);
    }
  }
  return Array.from(byId.values())
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    .slice(0, 200);
}

function mergeReadiness(
  local: DailyReadinessCheckIn[],
  cloud: DailyReadinessCheckIn[],
) {
  const byDate = new Map<string, DailyReadinessCheckIn>();
  for (const item of [...cloud, ...local]) {
    const current = byDate.get(item.dateKey);
    if (
      !current ||
      new Date(item.recordedAt).getTime() >=
        new Date(current.recordedAt).getTime()
    ) {
      byDate.set(item.dateKey, item);
    }
  }
  return Array.from(byDate.values())
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() -
        new Date(a.recordedAt).getTime(),
    )
    .slice(0, 90);
}

async function upsertProfile(session: CloudSession) {
  const updatedAt = loadProfileUpdatedAt() ?? new Date().toISOString();
  const row: ProfileRow = {
    user_id: session.user.id,
    data: loadProfile(),
    client_updated_at: updatedAt,
  };
  await cloudRequest(
    "aura_profiles?on_conflict=user_id",
    session,
    {
      method: "POST",
      headers: apiHeaders(
        session,
        "resolution=merge-duplicates,return=minimal",
      ),
      body: JSON.stringify(row),
    },
  );
}

async function upsertReadiness(
  session: CloudSession,
  dateKey?: string,
) {
  const rows = loadReadinessHistory()
    .filter((item) => !dateKey || item.dateKey === dateKey)
    .map<ReadinessRow>((item) => ({
      user_id: session.user.id,
      date_key: item.dateKey,
      data: item,
      recorded_at: item.recordedAt,
    }));
  if (!rows.length) return;

  await cloudRequest(
    "aura_readiness?on_conflict=user_id,date_key",
    session,
    {
      method: "POST",
      headers: apiHeaders(
        session,
        "resolution=merge-duplicates,return=minimal",
      ),
      body: JSON.stringify(rows),
    },
  );
}

async function upsertWorkouts(
  session: CloudSession,
  workoutId?: string,
) {
  const rows = loadHistory()
    .filter((item) => !workoutId || item.id === workoutId)
    .map<WorkoutRow>((workout) => ({
      user_id: session.user.id,
      workout_id: workout.id,
      workout_date: workout.date,
      data: workout,
    }));
  if (!rows.length) return;

  await cloudRequest(
    "aura_workouts?on_conflict=user_id,workout_id",
    session,
    {
      method: "POST",
      headers: apiHeaders(
        session,
        "resolution=merge-duplicates,return=minimal",
      ),
      body: JSON.stringify(rows),
    },
  );
}

export async function syncLocalChange(change: LocalDataChange) {
  const session = await getValidCloudSession();
  if (!session) return;

  try {
    emitStatus({ state: "syncing", message: "مزامنة آخر تغيير..." });
    if (change.kind === "profile") await upsertProfile(session);
    if (change.kind === "readiness") {
      await upsertReadiness(session, change.dateKey);
    }
    if (change.kind === "workout") {
      await upsertWorkouts(session, change.id);
    }
    emitStatus({
      state: "synced",
      message: "تمت المزامنة",
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    emitStatus({
      state: "error",
      message:
        error instanceof Error ? error.message : "تعذرت المزامنة.",
    });
  }
}

export async function runFullCloudSync() {
  const session = await getValidCloudSession();
  if (!session) {
    return { signedIn: false as const };
  }

  emitStatus({ state: "syncing", message: "مزامنة البيانات..." });

  try {
    const userId = encodeURIComponent(session.user.id);
    const [profileRows, readinessRows, workoutRows] = await Promise.all([
      cloudRequest<ProfileRow[]>(
        "aura_profiles?select=user_id,data,client_updated_at,updated_at&user_id=eq." +
          userId +
          "&limit=1",
        session,
      ),
      cloudRequest<ReadinessRow[]>(
        "aura_readiness?select=user_id,date_key,data,recorded_at,updated_at&user_id=eq." +
          userId +
          "&order=date_key.desc&limit=90",
        session,
      ),
      cloudRequest<WorkoutRow[]>(
        "aura_workouts?select=user_id,workout_id,workout_date,data,updated_at&user_id=eq." +
          userId +
          "&order=workout_date.desc&limit=200",
        session,
      ),
    ]);

    const localProfileUpdated = loadProfileUpdatedAt();
    const cloudProfile = profileRows[0];
    if (cloudProfile) {
      const cloudTime = new Date(
        cloudProfile.client_updated_at ?? cloudProfile.updated_at ?? 0,
      ).getTime();
      const localTime = localProfileUpdated
        ? new Date(localProfileUpdated).getTime()
        : 0;
      if (!localProfileUpdated || cloudTime > localTime) {
        replaceLocalProfile(
          cloudProfile.data,
          cloudProfile.client_updated_at ??
            cloudProfile.updated_at ??
            new Date().toISOString(),
          false,
        );
      }
    }

    const mergedReadiness = mergeReadiness(
      loadReadinessHistory(),
      readinessRows.map((row) => ({
        ...row.data,
        dateKey: row.date_key,
        recordedAt: row.recorded_at,
      })),
    );
    replaceLocalReadinessHistory(mergedReadiness, false);

    const mergedHistory = mergeHistory(
      loadHistory(),
      workoutRows.map((row) => ({
        ...row.data,
        id: row.workout_id,
        date: row.workout_date,
      })),
    );
    replaceLocalHistory(mergedHistory, false);

    await Promise.all([
      upsertProfile(session),
      upsertReadiness(session),
      upsertWorkouts(session),
    ]);

    const syncedAt = new Date().toISOString();
    emitStatus({
      state: "synced",
      message: "تمت مزامنة الحساب",
      syncedAt,
    });
    return {
      signedIn: true as const,
      syncedAt,
      profile: loadProfile(),
      readiness: mergedReadiness.length,
      workouts: mergedHistory.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذرت المزامنة.";
    emitStatus({ state: "error", message });
    throw error;
  }
}

export function currentCloudUser() {
  return loadCloudSession()?.user ?? null;
}
