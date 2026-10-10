import type { LocalDataChange } from "./user-profile";

/**
 * Browser-only sync audit trail, partitioned by authenticated user. The
 * timestamps indicate when the REST read-back completed, not a guaranteed
 * multi-device transaction or a durable server backup.
 */
export const CLOUD_SYNC_LEDGER_UPDATED_EVENT = "aura:cloud-sync-ledger-updated";

export type CloudSyncLedger = {
  version: 1;
  revision: number;
  pending: Record<string, number>;
  verifiedAt: string | null;
};

const PREFIX = "aura.cloud.sync-ledger.v1.";
const EMPTY: CloudSyncLedger = {
  version: 1,
  revision: 0,
  pending: {},
  verifiedAt: null,
};

function path(userId: string) {
  return PREFIX + encodeURIComponent(userId);
}

function available() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function read(userId: string): CloudSyncLedger {
  if (!userId || !available()) return { ...EMPTY, pending: {} };
  try {
    const raw = localStorage.getItem(path(userId));
    if (!raw) return { ...EMPTY, pending: {} };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY, pending: {} };
    const item = parsed as Partial<CloudSyncLedger>;
    if (
      item.version !== 1 ||
      !Number.isSafeInteger(item.revision) ||
      (item.revision ?? -1) < 0 ||
      !item.pending ||
      typeof item.pending !== "object" ||
      Array.isArray(item.pending)
    ) {
      return { ...EMPTY, pending: {} };
    }
    const pending = Object.fromEntries(
      Object.entries(item.pending).filter(
        ([key, revision]) =>
          typeof key === "string" &&
          /^(profile|workout:|readiness:)/.test(key) &&
          Number.isSafeInteger(revision) &&
          revision > 0 &&
          revision <= item.revision!,
      ),
    ) as Record<string, number>;
    return {
      version: 1,
      revision: item.revision!,
      pending,
      verifiedAt:
        typeof item.verifiedAt === "string" &&
        Number.isFinite(Date.parse(item.verifiedAt))
          ? item.verifiedAt
          : null,
    };
  } catch {
    return { ...EMPTY, pending: {} };
  }
}

function write(userId: string, next: CloudSyncLedger) {
  if (!userId || !available()) return;
  try {
    localStorage.setItem(path(userId), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(CLOUD_SYNC_LEDGER_UPDATED_EVENT, {
        detail: { userId },
      }),
    );
  } catch {
    // The training app remains local-first even if browser storage is blocked.
  }
}

export function cloudChangeKey(change: LocalDataChange) {
  if (change.kind === "profile") return "profile";
  if (change.kind === "readiness") return "readiness:" + change.dateKey;
  return "workout:" + change.id;
}

export function loadCloudSyncLedger(userId: string): CloudSyncLedger {
  return read(userId);
}

export function pendingCloudChanges(userId: string) {
  return Object.keys(read(userId).pending).length;
}

/** Called before attempting a network write, so failures never look synced. */
export function markCloudChangePending(userId: string, change: LocalDataChange) {
  const current = read(userId);
  const revision = current.revision + 1;
  write(userId, {
    ...current,
    revision,
    pending: { ...current.pending, [cloudChangeKey(change)]: revision },
  });
  return revision;
}

/**
 * A late verification must not acknowledge an edit made while that request
 * was in flight. It may acknowledge only the exact revision it began with.
 */
export function confirmCloudChange(
  userId: string,
  change: LocalDataChange,
  revision: number,
) {
  const current = read(userId);
  const key = cloudChangeKey(change);
  if (current.pending[key] !== revision) return;
  const pending = { ...current.pending };
  delete pending[key];
  write(userId, {
    ...current,
    pending,
    verifiedAt: Object.keys(pending).length === 0
      ? new Date().toISOString()
      : current.verifiedAt,
  });
}

/** Snapshot pending revisions BEFORE a full sync starts fetching remote data. */
export function snapshotPendingCloudChanges(userId: string) {
  return { ...read(userId).pending };
}

export function confirmFullCloudSync(
  userId: string,
  snapshot: Record<string, number>,
) {
  const current = read(userId);
  const pending = { ...current.pending };
  for (const [key, revision] of Object.entries(snapshot)) {
    if (pending[key] === revision) delete pending[key];
  }
  write(userId, {
    ...current,
    pending,
    verifiedAt: Object.keys(pending).length === 0
      ? new Date().toISOString()
      : current.verifiedAt,
  });
}
