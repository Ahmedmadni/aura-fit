/** Browser-local per-account datasets. This is not a security boundary. */
const OWNER_KEY = "aura.cloud.local-owner.v1";
const PREFIX = "aura.cloud.local-data.v1.";
const LOCAL_KEYS = [
  "kp.profile", "kp.profile.updated-at", "kp.history", "kp.readiness",
  "kp.achievements", "aura.workout-session.v1",
  "aura.workout-session-meta.v1",
] as const;

type LocalSnapshot = { version: 1; entries: Record<string, string> };

function storage() {
  if (typeof localStorage === "undefined") throw new Error("Local storage unavailable.");
  return localStorage;
}
function snapshot(): LocalSnapshot {
  const entries: Record<string, string> = {};
  for (const key of LOCAL_KEYS) {
    const value = storage().getItem(key);
    if (value !== null) entries[key] = value;
  }
  return { version: 1, entries };
}
function apply(s: LocalSnapshot) {
  for (const key of LOCAL_KEYS) {
    const value = s.entries[key];
    if (value === undefined) storage().removeItem(key);
    else storage().setItem(key, value);
  }
}
function readSnapshot(userId: string): LocalSnapshot {
  const raw = storage().getItem(PREFIX + encodeURIComponent(userId));
  if (!raw) return { version: 1, entries: {} };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Saved local data for this account are damaged; no account switch was made."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Saved local account data have an invalid format.");
  }
  const data = parsed as Partial<LocalSnapshot>;
  if (data.version !== 1 || !data.entries || typeof data.entries !== "object" ||
      Array.isArray(data.entries) ||
      Object.entries(data.entries).some(([k, v]) =>
        !LOCAL_KEYS.includes(k as typeof LOCAL_KEYS[number]) || typeof v !== "string")) {
    throw new Error("Saved local account data have an unsupported format.");
  }
  return { version: 1, entries: data.entries };
}

/** Tag legacy device data with the account from which a user signs out. */
export function retainLocalAccountOwner(userId: string) {
  if (!storage().getItem(OWNER_KEY)) storage().setItem(OWNER_KEY, userId);
}

/**
 * First login adopts existing guest data. Later account changes archive the
 * prior account and load only the next account's own dataset.
 * Neither archived data nor credentials are ever uploaded by this helper.
 */
export function activateLocalAccount(userId: string, previousUserId?: string) {
  if (!userId) throw new Error("Cloud user ID is required.");
  const currentOwner = storage().getItem(OWNER_KEY) || previousUserId || null;
  if (!currentOwner || currentOwner === userId) {
    storage().setItem(OWNER_KEY, userId);
    return;
  }
  const destination = readSnapshot(userId);
  const before = snapshot();
  // A failed archive must prevent the switch; no previous data is discarded.
  storage().setItem(PREFIX + encodeURIComponent(currentOwner), JSON.stringify(before));
  try {
    apply(destination);
    storage().setItem(OWNER_KEY, userId);
  } catch (error) {
    try {
      apply(before);
      storage().setItem(OWNER_KEY, currentOwner);
    } catch {
      // The saved archive remains available for recovery if storage is full.
    }
    throw error;
  }
}
export const LOCAL_ACCOUNT_DATA_KEYS = LOCAL_KEYS;
