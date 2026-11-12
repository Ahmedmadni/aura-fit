/**
 * Standalone client bundle for Android WebViewAssetLoader.
 * Do not use the Lovable/SSR Vite config here: the APK has no Node server.
 */
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  base: "/assets/web/",
  publicDir: "public",
  define: {
    // Compile out cloud configuration from the fully offline APK.
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
    "import.meta.env.VITE_AURA_EMBEDDED_ANDROID": JSON.stringify("true"),
  },
  build: {
    target: "es2022",
    outDir: "android-offline/app/src/main/assets/web",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), "offline/index.html"),
    },
  },
});
