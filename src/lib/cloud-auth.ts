import { getCloudConfig } from "./cloud-config";
import { activateLocalAccount, retainLocalAccountOwner } from "./cloud-local-vault";

const SESSION_KEY = "kp.cloud.session";
export const CLOUD_AUTH_CHANGED_EVENT = "aura:cloud-auth-changed";

export interface CloudUser {
  id: string;
  email?: string;
}

export interface CloudSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user: CloudUser;
}

type AuthResponse = Partial<CloudSession> & {
  user?: CloudUser;
  error?: string;
  error_description?: string;
  msg?: string;
};

class CloudAuthRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CloudAuthRequestError";
  }
}

// Deduplicate simultaneous refreshes of the SAME token, without allowing an
// old account's refresh result to replace a newer sign-in or sign-out.
let refreshInFlight: {
  token: string;
  promise: Promise<CloudSession | null>;
} | null = null;

function storageAvailable() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLOUD_AUTH_CHANGED_EVENT));
  }
}

export function loadCloudSession(): CloudSession | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CloudSession;
    if (!parsed?.access_token || !parsed?.refresh_token || !parsed?.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCloudSession(session: CloudSession | null) {
  if (!storageAvailable()) return;
  const previous = loadCloudSession();
  if (session) {
    // Partition device data before advertising a different cloud account.
    // Corrupted/unsaved target data abort the switch and keep the old session.
    activateLocalAccount(session.user.id, previous?.user.id);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    if (previous) retainLocalAccountOwner(previous.user.id);
    localStorage.removeItem(SESSION_KEY);
  }
  emitAuthChanged();
}

function normalizeSession(payload: AuthResponse): CloudSession | null {
  if (
    !payload.access_token ||
    !payload.refresh_token ||
    !payload.user?.id
  ) {
    return null;
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at:
      payload.expires_at ??
      (payload.expires_in
        ? Math.floor(Date.now() / 1000) + payload.expires_in
        : undefined),
    expires_in: payload.expires_in,
    token_type: payload.token_type,
    user: payload.user,
  };
}

async function authRequest(
  path: string,
  init: RequestInit,
): Promise<AuthResponse> {
  const config = getCloudConfig();
  if (!config) throw new Error("Cloud sync is not configured.");

  const response = await fetch(config.url + path, {
    ...init,
    headers: {
      apikey: config.key,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as AuthResponse;
  if (!response.ok) {
    throw new CloudAuthRequestError(
      payload.error_description ??
        payload.msg ??
        payload.error ??
        "Cloud authentication request failed.",
      response.status,
    );
  }
  return payload;
}

export async function signInCloud(email: string, password: string) {
  const payload = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const session = normalizeSession(payload);
  if (!session) throw new Error("No session returned after sign in.");
  saveCloudSession(session);
  return session;
}

export async function signUpCloud(email: string, password: string) {
  const payload = await authRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const session = normalizeSession(payload);
  if (session) saveCloudSession(session);
  return {
    session,
    user: payload.user ?? session?.user ?? null,
    confirmationRequired: Boolean(payload.user && !session),
  };
}

export function refreshCloudSession(
  current = loadCloudSession(),
): Promise<CloudSession | null> {
  if (!current) return Promise.resolve(null);
  if (refreshInFlight?.token === current.refresh_token) {
    return refreshInFlight.promise;
  }

  const promise = (async (): Promise<CloudSession | null> => {
    try {
      const payload = await authRequest(
        "/auth/v1/token?grant_type=refresh_token",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: current.refresh_token }),
        },
      );

      // A slow response must never resurrect a signed-out account or replace
      // the credentials of another account that signed in while it was pending.
      const latest = loadCloudSession();
      if (
        !latest ||
        latest.refresh_token !== current.refresh_token ||
        latest.user.id !== current.user.id
      ) {
        return latest;
      }

      const session = normalizeSession(payload);
      if (!session || session.user.id !== current.user.id) {
        saveCloudSession(null);
        return null;
      }
      saveCloudSession(session);
      return session;
    } catch (error) {
      if (
        error instanceof CloudAuthRequestError &&
        (error.status === 400 || error.status === 401)
      ) {
        // Explicit invalid/expired refresh-token response: clear the account
        // only if it is still the account that initiated this request.
        const latest = loadCloudSession();
        if (
          latest?.refresh_token === current.refresh_token &&
          latest.user.id === current.user.id
        ) {
          saveCloudSession(null);
          return null;
        }
        return latest;
      }
      // Timeouts, offline fetch errors and 5xx are NOT a logout.
      throw error;
    }
  })();

  refreshInFlight = { token: current.refresh_token, promise };
  void promise.then(
    () => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    },
    () => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    },
  );
  return promise;
}

export async function getValidCloudSession() {
  const current = loadCloudSession();
  if (!current) return null;
  const expiresAt = current.expires_at;
  // Legacy sessions without an expiry cannot safely be assumed expired.
  // Avoid rotating their refresh token on every write; an actual 401 remains
  // visible to the sync layer instead of silently removing the account.
  if (!expiresAt || expiresAt - Math.floor(Date.now() / 1000) > 60) {
    return current;
  }

  try {
    return await refreshCloudSession(current);
  } catch {
    // Retain credentials through transient network/server failures. The
    // downstream request may still succeed, or full sync retries on reconnect.
    const latest = loadCloudSession();
    return latest?.user.id === current.user.id ? latest : null;
  }
}

export async function signOutCloud() {
  const config = getCloudConfig();
  const session = loadCloudSession();
  try {
    if (config && session) {
      await fetch(config.url + "/auth/v1/logout", {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: "Bearer " + session.access_token,
          "Content-Type": "application/json",
        },
      });
    }
  } finally {
    saveCloudSession(null);
  }
}
