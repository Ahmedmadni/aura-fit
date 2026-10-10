/**
 * Coalesces lifecycle-driven cloud reconciliations without delaying an
 * account switch, a pending offline save, or a new edit during an active sync.
 *
 * The profile's explicit "Sync now" action calls runFullCloudSync directly;
 * this coordinator intentionally handles automatic background triggers only.
 */
export type CloudSyncTrigger = "initial" | "auth" | "online" | "visible" | "local";

type Options = {
  getUserId: () => string | null;
  getPendingCount: (userId: string) => number;
  runFullSync: () => Promise<unknown>;
  now?: () => number;
  quietPeriodMs?: number;
};

export function createCloudSyncCoordinator({
  getUserId,
  getPendingCount,
  runFullSync,
  now = Date.now,
  quietPeriodMs = 45_000,
}: Options) {
  let disposed = false;
  let active: Promise<void> | null = null;
  let runningUser: string | null = null;
  let retryAfterCurrent = false;
  let lastSuccessful: { userId: string; at: number } | null = null;

  async function pump() {
    do {
      if (disposed) break;
      const userId = getUserId();
      if (!userId) {
        lastSuccessful = null;
        break;
      }
      retryAfterCurrent = false;
      runningUser = userId;
      try {
        await runFullSync();
        // A 200 HTTP response does not guarantee that *every* change reached
        // the server; the per-account ledger remains authoritative.
        if (getUserId() === userId && getPendingCount(userId) === 0) {
          lastSuccessful = { userId, at: now() };
        } else {
          lastSuccessful = null;
        }
      } catch {
        // The sync layer emits status and retains local-first data. A later
        // lifecycle trigger must retry, even inside the quiet period.
        lastSuccessful = null;
      } finally {
        runningUser = null;
      }
    } while (retryAfterCurrent && !disposed);
  }

  function request(reason: CloudSyncTrigger): Promise<void> {
    if (disposed) return Promise.resolve();
    const userId = getUserId();
    if (!userId) {
      lastSuccessful = null;
      // If the previous account signed out mid-sync, never reuse its
      // last-successful timestamp for a later sign-in.
      if (active) retryAfterCurrent = true;
      return active ?? Promise.resolve();
    }

    if (active) {
      // In-flight visibility notifications are already being reconciled.
      // Account transitions, reconnects, and local edits must be replayed.
      if (
        reason === "online" ||
        reason === "local" ||
        (reason === "auth" && userId !== runningUser)
      ) {
        retryAfterCurrent = true;
      }
      return active;
    }

    // A local-change event has its own incremental uploader. Only schedule
    // an extra full reconciliation when one was already in progress.
    if (reason === "local") return Promise.resolve();

    const quiet =
      reason !== "initial" &&
      lastSuccessful?.userId === userId &&
      now() - lastSuccessful.at >= 0 &&
      now() - lastSuccessful.at < quietPeriodMs &&
      getPendingCount(userId) === 0;
    if (quiet) return Promise.resolve();

    const running = pump();
    active = running;
    void running.finally(() => {
      if (active === running) active = null;
    });
    return running;
  }

  return {
    request,
    dispose() {
      disposed = true;
      retryAfterCurrent = false;
    },
  };
}
