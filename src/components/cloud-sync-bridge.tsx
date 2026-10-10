import { useEffect } from "react";
import {
  CLOUD_AUTH_CHANGED_EVENT,
  loadCloudSession,
} from "@/lib/cloud-auth";
import { isCloudConfigured } from "@/lib/cloud-config";
import { pendingCloudChanges } from "@/lib/cloud-sync-ledger";
import { createCloudSyncCoordinator } from "@/lib/cloud-sync-scheduler";
import { runFullCloudSync, syncLocalChange } from "@/lib/cloud-sync";
import {
  LOCAL_DATA_CHANGED_EVENT,
  type LocalDataChange,
} from "@/lib/user-profile";

export function CloudSyncBridge() {
  useEffect(() => {
    if (!isCloudConfigured()) return;

    const coordinator = createCloudSyncCoordinator({
      getUserId: () => loadCloudSession()?.user.id ?? null,
      getPendingCount: pendingCloudChanges,
      runFullSync: runFullCloudSync,
    });

    const onAuth = () => void coordinator.request("auth");
    // A reconnect always retries outstanding changes. An immediate repeat
    // with an already-verified ledger is coalesced inside the coordinator.
    const onOnline = () => void coordinator.request("online");
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void coordinator.request("visible");
      }
    };
    const onLocal = (event: Event) => {
      const detail = (event as CustomEvent<LocalDataChange>).detail;
      if (!detail || !loadCloudSession()) return;
      // The incremental write marks its revision pending immediately. If
      // a full sync is running, schedule a final pass before declaring idle.
      void syncLocalChange(detail);
      void coordinator.request("local");
    };

    window.addEventListener(CLOUD_AUTH_CHANGED_EVENT, onAuth);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, onLocal);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    void coordinator.request("initial");

    return () => {
      coordinator.dispose();
      window.removeEventListener(CLOUD_AUTH_CHANGED_EVENT, onAuth);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, onLocal);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
