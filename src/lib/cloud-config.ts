export interface CloudConfig {
  url: string;
  key: string;
}

function clean(value: string | undefined) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

export function getCloudConfig(): CloudConfig | null {
  const url = clean(import.meta.env.VITE_SUPABASE_URL);
  const key = clean(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  );

  if (!url || !key) return null;
  if (!/^https:\/\/.+\.supabase\.co$/i.test(url)) return null;
  return { url, key };
}

export function isCloudConfigured() {
  return getCloudConfig() !== null;
}
