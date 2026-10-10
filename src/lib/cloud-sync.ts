import { getCloudConfig } from "./cloud-config";
import {
  confirmCloudChange,
  confirmFullCloudSync,
  markCloudChangePending,
  pendingCloudChanges,
  snapshotPendingCloudChanges,
} from "./cloud-sync-ledger";
import {
  getValidCloudSession,
  loadCloudSession,
  type CloudSession,
} from "./cloud-auth";
import {
  MAX_LOCAL_READINESS,
  MAX_LOCAL_WORKOUTS,
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
    .slice(0, MAX_LOCAL_WORKOUTS);
}

function mergeReadiness(
  local: DailyReadinessCheckIn[],
  cloud: DailyReadinessCheckIn[],
) {
  const byDate = new Map<string, DailyReadinessCheckIn>();
  // On exactly equal timestamps, use the row accepted by Supabase.
  for (const item of [...local, ...cloud]) {
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
    .slice(0, MAX_LOCAL_READINESS);
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

// PostgREST may accept an insert, reject an older conditional PATCH, or
// ignore an existing immutable workout. A successful HTTP response alone does
// NOT prove that the local and server copies agree. Always read back the
// server-selected row before claiming an individual change is synced.
function validTime(value: string | null | undefined) {
  if (!value) return -Infinity;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : -Infinity;
}

function applyProfileRow(session: CloudSession, cloudProfile?: ProfileRow) {
  assertCurrentCloudUser(session);
  if (!cloudProfile) return;
  if (
    validTime(cloudProfile.client_updated_at ?? cloudProfile.updated_at) >=
    validTime(loadProfileUpdatedAt())
  ) {
    replaceLocalProfile(
      cloudProfile.data,
      cloudProfile.client_updated_at ?? cloudProfile.updated_at ??
        new Date().toISOString(),
      false,
    );
  }
}

function applyReadinessRows(session: CloudSession, rows: ReadinessRow[]) {
  assertCurrentCloudUser(session);
  const merged = mergeReadiness(
    loadReadinessHistory(),
    rows.map((row) => ({
      ...row.data,
      dateKey: row.date_key,
      recordedAt: row.recorded_at,
    })),
  );
  replaceLocalReadinessHistory(merged, false);
  return merged;
}

function applyWorkoutRows(session: CloudSession, rows: WorkoutRow[]) {
  assertCurrentCloudUser(session);
  const merged = mergeHistory(
    loadHistory(),
    rows.map((row) => ({
      ...row.data,
      id: row.workout_id,
      date: row.workout_date,
    })),
  );
  replaceLocalHistory(merged, false);
  return merged;
}

/** Page history in blocks of 100: do not rely on a single API response
 * containing the whole local working set. A deterministic tie-breaker keeps
 * workout pagination stable when several sessions share the same date.
 */
async function readPagedCloudRows<T>(
  session: CloudSession,
  table: string,
  select: string,
  order: string,
  maximum: number,
): Promise<T[]> {
  const id = encodeURIComponent(session.user.id);
  const rows: T[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < maximum; offset += pageSize) {
    assertCurrentCloudUser(session);
    const count = Math.min(pageSize, maximum - offset);
    const page = await cloudRequest<T[]>(
      table + "?select=" + select + "&user_id=eq." + id +
        "&order=" + order + "&limit=" + count + "&offset=" + offset,
      session,
    );
    if (!Array.isArray(page) || page.length > count) {
      throw new Error("Supabase returned an invalid history page.");
    }
    rows.push(...page);
    if (page.length < count) break;
  }
  return rows;
}

async function readFullCloudRows(session: CloudSession) {
  const id = encodeURIComponent(session.user.id);
  const [profiles, readiness, workouts] = await Promise.all([
    cloudRequest<ProfileRow[]>(
      "aura_profiles?select=user_id,data,client_updated_at,updated_at&user_id=eq." +
        id + "&limit=1",
      session,
    ),
    readPagedCloudRows<ReadinessRow>(
      session, "aura_readiness",
      "user_id,date_key,data,recorded_at,updated_at",
      "date_key.desc", MAX_LOCAL_READINESS,
    ),
    readPagedCloudRows<WorkoutRow>(
      session, "aura_workouts",
      "user_id,workout_id,workout_date,data,updated_at",
      "workout_date.desc,workout_id.desc", MAX_LOCAL_WORKOUTS,
    ),
  ]);
  return { profiles, readiness, workouts };
}

/** The expanded local window must not generate hundreds of redundant
 * readiness PATCH operations on every login / tab visibility change.
 * New rows are inserted in one bulk request; existing rows are PATCHed only
 * if the local timestamp is strictly newer than the fetched cloud version.
 */
async function uploadFullReadinessDeltas(
  session: CloudSession,
  server: ReadinessRow[],
) {
  assertCurrentCloudUser(session);
  const byDate = new Map(server.map(row => [row.date_key, row]));
  const missing: ReadinessRow[] = [];
  const newer: ReadinessRow[] = [];
  for (const item of loadReadinessHistory()) {
    const cloud = byDate.get(item.dateKey);
    if (cloud && validTime(item.recordedAt) <= validTime(cloud.recorded_at)) {
      continue;
    }
    const row: ReadinessRow = {
      user_id: session.user.id,
      date_key: item.dateKey,
      data: item,
      recorded_at: item.recordedAt,
    };
    if (cloud) newer.push(row);
    else missing.push(row);
  }
  if (missing.length) {
    await insertOnly(session, "aura_readiness", "user_id,date_key", missing);
  }
  for (const row of newer) {
    assertCurrentCloudUser(session);
    await updateOnlyIfOlder(
      session, "aura_readiness",
      "user_id=eq." + encodeURIComponent(session.user.id) +
        "&date_key=eq." + encodeURIComponent(row.date_key),
      "recorded_at", row.recorded_at, row,
    );
  }
}

async function uploadFullWorkoutDeltas(session: CloudSession, server: WorkoutRow[]) {
  assertCurrentCloudUser(session);
  const ids = new Set(server.map(row => row.workout_id));
  const missing = loadHistory()
    .filter(workout => !ids.has(workout.id))
    .map<WorkoutRow>(workout => ({
      user_id: session.user.id,
      workout_id: workout.id,
      workout_date: workout.date,
      data: workout,
    }));
  if (missing.length) {
    await insertOnly(session, "aura_workouts", "user_id,workout_id", missing);
  }
}

function applyFullCloudRows(
  session: CloudSession,
  rows: Awaited<ReturnType<typeof readFullCloudRows>>,
) {
  assertCurrentCloudUser(session);
  applyProfileRow(session, rows.profiles[0]);
  const readiness = applyReadinessRows(session, rows.readiness);
  const workouts = applyWorkoutRows(session, rows.workouts);
  return { readiness, workouts };
}

class CloudRecordNotVerifiedError extends Error {
  constructor() {
    super("لم يتم التحقق من حفظ هذا التغيير على الخادم. لا يزال محفوظًا محليًا.");
    this.name = "CloudRecordNotVerifiedError";
  }
}

// A PostgREST 204 can mean that INSERT ... DO NOTHING or a timestamp-guarded
// PATCH affected zero rows. Only the server's actual matching row can
// acknowledge a pending local change.
function serverHasAcceptedProfile(row?: ProfileRow) {
  const timestamp = loadProfileUpdatedAt();
  return Boolean(
    row && timestamp && Number.isFinite(validTime(timestamp)) &&
    validTime(row.client_updated_at) >= validTime(timestamp),
  );
}

function serverHasAcceptedReadiness(row: ReadinessRow | undefined, dateKey: string) {
  const local = loadReadinessHistory().find((item) => item.dateKey === dateKey);
  return Boolean(
    row && local && row.date_key === dateKey &&
    Number.isFinite(validTime(local.recordedAt)) &&
    validTime(row.recorded_at) >= validTime(local.recordedAt),
  );
}

function serverHasAcceptedWorkout(row: WorkoutRow | undefined, workoutId: string) {
  return Boolean(row && row.workout_id === workoutId &&
    loadHistory().some((item) => item.id === workoutId));
}

/** Never confirm a change when the server read-back is empty or outdated. */
async function verifyLocalChange(session: CloudSession, change: LocalDataChange) {
  const userId = encodeURIComponent(session.user.id);
  if (change.kind === "profile") {
    const rows = await cloudRequest<ProfileRow[]>(
      "aura_profiles?select=user_id,data,client_updated_at,updated_at&user_id=eq." +
        userId + "&limit=1",
      session,
    );
    assertCurrentCloudUser(session);
    if (!serverHasAcceptedProfile(rows[0])) throw new CloudRecordNotVerifiedError();
    applyProfileRow(session, rows[0]);
  } else if (change.kind === "readiness") {
    const rows = await cloudRequest<ReadinessRow[]>(
      "aura_readiness?select=user_id,date_key,data,recorded_at,updated_at&user_id=eq." +
        userId + "&date_key=eq." + encodeURIComponent(change.dateKey) + "&limit=1",
      session,
    );
    assertCurrentCloudUser(session);
    if (!serverHasAcceptedReadiness(rows[0], change.dateKey)) {
      throw new CloudRecordNotVerifiedError();
    }
    applyReadinessRows(session, rows);
  } else if (change.kind === "workout") {
    const rows = await cloudRequest<WorkoutRow[]>(
      "aura_workouts?select=user_id,workout_id,workout_date,data,updated_at&user_id=eq." +
        userId + "&workout_id=eq." + encodeURIComponent(change.id) + "&limit=1",
      session,
    );
    assertCurrentCloudUser(session);
    if (!serverHasAcceptedWorkout(rows[0], change.id)) {
      throw new CloudRecordNotVerifiedError();
    }
    applyWorkoutRows(session, rows);
  }
}

/**
 * A full sync fetches only the bounded recent working set. Do not
 * acknowledge a pending item merely because other rows were read successfully.
 * This also prevents "success" if the server silently ignored a write.
 */
function verifiedPendingSnapshot(
  session: CloudSession,
  snapshot: Record<string, number>,
  rows: Awaited<ReturnType<typeof readFullCloudRows>>,
) {
  assertCurrentCloudUser(session);
  const accepted: Record<string, number> = {};
  const byDate = new Map(rows.readiness.map(row => [row.date_key, row]));
  const byWorkout = new Map(rows.workouts.map(row => [row.workout_id, row]));
  for (const [key, revision] of Object.entries(snapshot)) {
    if (
      (key === "profile" && serverHasAcceptedProfile(rows.profiles[0])) ||
      (key.startsWith("readiness:") &&
        serverHasAcceptedReadiness(byDate.get(key.slice(10)), key.slice(10))) ||
      (key.startsWith("workout:") &&
        serverHasAcceptedWorkout(byWorkout.get(key.slice(8)), key.slice(8)))
    ) {
      accepted[key] = revision;
    }
  }
  return accepted;
}

export async function syncLocalChange(change: LocalDataChange) {
  // Mark the unsaved local edit BEFORE awaiting an expired session refresh or
  // any network request. An offline failure must leave it visible as pending.
  const userId = loadCloudSession()?.user.id;
  if (!userId) return;
  const revision = markCloudChangePending(userId, change);
  const session = await getValidCloudSession();
  if (!session || session.user.id !== userId ||
      loadCloudSession()?.user.id !== userId) return;

  try {
    emitStatus({ state: "syncing", message: "مزامنة آخر تغيير..." });
    if (change.kind === "profile") await upsertProfile(session);
    if (change.kind === "readiness") {
      await upsertReadiness(session, change.dateKey);
    }
    if (change.kind === "workout") {
      await upsertWorkouts(session, change.id);
    }
    // Verify what the server actually retained; it can reject a stale write.
    // A newer local edit during this request is preserved by timestamp checks.
    await verifyLocalChange(session, change);
    assertCurrentCloudUser(session);
    confirmCloudChange(userId, change, revision);
    const remaining = pendingCloudChanges(userId);
    emitStatus({
      state: "synced",
      message: remaining
        ? "تم التحقق من التغيير، ولا تزال هناك تغييرات أخرى بانتظار المزامنة."
        : "تمت مطابقة التغيير مع البيانات السحابية",
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
  // A local change made after this point must NOT be marked verified by
  // the full-sync's final response. Its own network upload is still pending.
  const pendingAtStart = snapshotPendingCloudChanges(session.user.id);
  emitStatus({ state: "syncing", message: "مزامنة البيانات..." });

  try {
    // Phase one: download remote data, then merge with the live local store.
    // Profile/readiness timestamps and immutable cloud workout IDs win
    // according to the same rules used for incremental changes.
    const initial = await readFullCloudRows(session);
    applyFullCloudRows(session, initial);

    await Promise.all([
      upsertProfile(session),
      uploadFullReadinessDeltas(session, initial.readiness),
      uploadFullWorkoutDeltas(session, initial.workouts),
    ]);

    // Phase two: confirm what PostgreSQL actually saved. This handles an
    // intervening edit by device B or an ignored duplicate/older PATCH and
    // avoids showing a false "synced" message with an outdated local copy.
    const verifiedRows = await readFullCloudRows(session);
    const confirmedRevisions = verifiedPendingSnapshot(
      session, pendingAtStart, verifiedRows,
    );
    const verified = applyFullCloudRows(session, verifiedRows);

    assertCurrentCloudUser(session);
    confirmFullCloudSync(session.user.id, confirmedRevisions);
    const remaining = pendingCloudChanges(session.user.id);
    const syncedAt = new Date().toISOString();
    emitStatus({
      state: "synced",
      message: remaining
        ? "اكتملت مراجعة السحابة، لكن توجد تغييرات محلية لم يُتحقق من رفعها بعد."
        : "تم التحقق من البيانات السحابية",
      syncedAt,
    });
    return {
      signedIn: true as const,
      syncedAt,
      profile: loadProfile(),
      readiness: verified.readiness.length,
      workouts: verified.workouts.length,
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
