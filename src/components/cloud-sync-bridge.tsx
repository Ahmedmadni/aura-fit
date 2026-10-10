import { useEffect } from "react";
import {
  CLOUD_AUTH_CHANGED_EVENT,
  loadCloudSession,
} from "@/lib/cloud-auth";
import { isCloudConfigured } from "@/lib/cloud-config";
import {
  runFullCloudSync,
  syncLocalChange,
} from "@/lib/cloud-sync";
import {
  LOCAL_DATA_CHANGED_EVENT,
  type LocalDataChange,
} from "@/lib/user-profile";

export function CloudSyncBridge() {
  useEffect(() => {
    if (!isCloudConfigured()) return;

    let disposed = false;
    let syncing = false;

    const fullSync = async () => {
      if (disposed || syncing || !loadCloudSession()) return;
      syncing = true;
      try {
        await runFullCloudSync();
      } catch {
        // Status is emitted by cloud-sync. Local-first operation continues.
      } finally {
        syncing = false;
      }
    };

    const onAuth = () => {
      void fullSync();
    };

    // Pending local changes remain local-first through offline periods. A
    // reconnect or return to the tab retries a full reconciliation.
    const onOnline = () => {
      void fullSync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void fullSync();
    };
    const onLocal = (event: Event) => {
      const detail = (event as CustomEvent<LocalDataChange>).detail;
      if (!detail || !loadCloudSession()) return;
      void syncLocalChange(detail);
    };

    window.addEventListener(CLOUD_AUTH_CHANGED_EVENT, onAuth);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, onLocal);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    void fullSync();

    return () => {
      disposed = true;
      window.removeEventListener(CLOUD_AUTH_CHANGED_EVENT, onAuth);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, onLocal);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
