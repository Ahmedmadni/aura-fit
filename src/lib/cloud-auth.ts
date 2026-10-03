import { getCloudConfig } from "./cloud-config";

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
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
    throw new Error(
      payload.error_description ??
        payload.msg ??
        payload.error ??
        "Cloud authentication request failed.",
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

export async function refreshCloudSession(
  current = loadCloudSession(),
): Promise<CloudSession | null> {
  if (!current) return null;
  const payload = await authRequest(
    "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    },
  );
  const session = normalizeSession(payload);
  if (!session) {
    saveCloudSession(null);
    return null;
  }
  saveCloudSession(session);
  return session;
}

export async function getValidCloudSession() {
  const current = loadCloudSession();
  if (!current) return null;
  const expiresAt = current.expires_at ?? 0;
  if (expiresAt && expiresAt - Math.floor(Date.now() / 1000) > 60) {
    return current;
  }

  try {
    return await refreshCloudSession(current);
  } catch {
    saveCloudSession(null);
    return null;
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
