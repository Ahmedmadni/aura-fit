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
    const onLocal = (event: Event) => {
      const detail = (event as CustomEvent<LocalDataChange>).detail;
      if (!detail || !loadCloudSession()) return;
      void syncLocalChange(detail);
    };

    window.addEventListener(CLOUD_AUTH_CHANGED_EVENT, onAuth);
    window.addEventListener(LOCAL_DATA_CHANGED_EVENT, onLocal);
    void fullSync();

    return () => {
      disposed = true;
      window.removeEventListener(CLOUD_AUTH_CHANGED_EVENT, onAuth);
      window.removeEventListener(LOCAL_DATA_CHANGED_EVENT, onLocal);
    };
  }, []);

  return null;
}
