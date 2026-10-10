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

// Never apply responses or create writes for an account that is no longer
// active. Cloud sync uses browser-global localStorage, which can change
// while awaiting network requests.
export class CloudAccountChangedError extends Error {
  constructor() {
    super("Cloud account changed while syncing.");
    this.name = "CloudAccountChangedError";
  }
}

function assertCurrentCloudUser(session: CloudSession) {
  if (loadCloudSession()?.user.id !== session.user.id) {
    throw new CloudAccountChangedError();
  }
}

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

  assertCurrentCloudUser(session);
  const response = await fetch(config.url + "/rest/v1/" + path, {
    ...init,
    headers: {
      ...apiHeaders(session),
      ...(init.headers ?? {}),
    },
  });

  // The request might have started under a different signed-in account.
  assertCurrentCloudUser(session);
  if (!response.ok) {
    const body = await response.text();
    assertCurrentCloudUser(session);
    throw new Error(
      "Cloud sync request failed (" +
        response.status +
        "): " +
        body.slice(0, 300),
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  assertCurrentCloudUser(session);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function mergeHistory(
  local: CompletedWorkout[],
  cloud: CompletedWorkout[],
) {
  // Completed workouts have no edit-version field. Their workout date is the
  // session date, NOT a last-edited timestamp. Treat an existing cloud ID as
  // authoritative rather than allowing a conflicting local copy to overwrite
  // an already saved cloud session.
  const byId = new Map<string, CompletedWorkout>();
  for (const workout of [...local, ...cloud]) {
    byId.set(workout.id, workout);
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

/**
 * PostgREST atomic compare-and-swap strategy, without requiring a new SQL
 * migration:
 * 1) INSERT ... ON CONFLICT DO NOTHING preserves an existing cloud row.
 * 2) PATCH WHERE stored client timestamp is strictly older. Concurrent PATCH
 *    requests cannot regress data because the timestamp condition is checked
 *    inside PostgreSQL at the time of the update.
 *
 * Device clocks must be reasonably accurate. This is timestamp-based LWW,
 * not a multi-field CRDT or server-clock consensus algorithm.
 */
async function insertOnly(
  session: CloudSession,
  table: string,
  conflictKeys: string,
  payload: unknown,
) {
  await cloudRequest(
    table + "?on_conflict=" + conflictKeys,
    session,
    {
      method: "POST",
      headers: apiHeaders(session, "resolution=ignore-duplicates,return=minimal"),
      body: JSON.stringify(payload),
    },
  );
}

async function updateOnlyIfOlder(
  session: CloudSession,
  table: string,
  selector: string,
  versionColumn: string,
  version: string,
  payload: unknown,
) {
  await cloudRequest(
    table + "?" + selector + "&" + versionColumn + "=lt." +
      encodeURIComponent(version),
    session,
    {
      method: "PATCH",
      headers: apiHeaders(session, "return=minimal"),
      body: JSON.stringify(payload),
    },
  );
}

async function upsertProfile(session: CloudSession) {
  assertCurrentCloudUser(session);
  // A fresh installation's DEFAULT_PROFILE is not a user edit. Never publish
  // an artificial timestamp which could erase a real profile from device B.
  const updatedAt = loadProfileUpdatedAt();
  if (!updatedAt) return;
  const row: ProfileRow = {
    user_id: session.user.id,
    data: loadProfile(),
    client_updated_at: updatedAt,
  };
  const selector = "user_id=eq." + encodeURIComponent(session.user.id);
  await insertOnly(session, "aura_profiles", "user_id", row);
  await updateOnlyIfOlder(
    session, "aura_profiles", selector, "client_updated_at", updatedAt, row,
  );
}

async function upsertReadiness(
  session: CloudSession,
  dateKey?: string,
) {
  assertCurrentCloudUser(session);
  const rows = loadReadinessHistory()
    .filter((item) => !dateKey || item.dateKey === dateKey)
    .map<ReadinessRow>((item) => ({
      user_id: session.user.id,
      date_key: item.dateKey,
      data: item,
      recorded_at: item.recordedAt,
    }));
  if (!rows.length) return;
  await insertOnly(session, "aura_readiness", "user_id,date_key", rows);
  for (const row of rows) {
    assertCurrentCloudUser(session);
    await updateOnlyIfOlder(
      session,
      "aura_readiness",
      "user_id=eq." + encodeURIComponent(session.user.id) +
        "&date_key=eq." + encodeURIComponent(row.date_key),
      "recorded_at",
      row.recorded_at,
      row,
    );
  }
}

async function upsertWorkouts(
  session: CloudSession,
  workoutId?: string,
) {
  assertCurrentCloudUser(session);
  const rows = loadHistory()
    .filter((item) => !workoutId || item.id === workoutId)
    .map<WorkoutRow>((workout) => ({
      user_id: session.user.id,
      workout_id: workout.id,
      workout_date: workout.date,
      data: workout,
    }));
  if (!rows.length) return;
  // Completed workouts are immutable across devices. Conflicting IDs are
  // resolved in favor of the already-stored cloud workout on the next fetch.
  await insertOnly(session, "aura_workouts", "user_id,workout_id", rows);
}

export async function syncLocalChange(change: LocalDataChange) {
  const session = await getValidCloudSession();
  if (!session || loadCloudSession()?.user.id !== session.user.id) return;

  try {
    emitStatus({ state: "syncing", message: "مزامنة آخر تغيير..." });
    if (change.kind === "profile") await upsertProfile(session);
    if (change.kind === "readiness") {
      await upsertReadiness(session, change.dateKey);
    }
    if (change.kind === "workout") {
      await upsertWorkouts(session, change.id);
    }
    assertCurrentCloudUser(session);
    emitStatus({
      state: "synced",
      message: "تمت المزامنة",
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof CloudAccountChangedError) return;
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

  assertCurrentCloudUser(session);
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

    assertCurrentCloudUser(session);
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

    assertCurrentCloudUser(session);
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
    if (!(error instanceof CloudAccountChangedError)) {
      const message =
        error instanceof Error ? error.message : "تعذرت المزامنة.";
      emitStatus({ state: "error", message });
    }
    throw error;
  }
}

export function currentCloudUser() {
  return loadCloudSession()?.user ?? null;
}
