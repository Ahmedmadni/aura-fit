/**
 * Dedicated browser-only entry for the opt-in Android offline edition.
 * Its HTML, JS, CSS and bundled exercise catalog live inside the APK.
 * No TanStack Start server is needed; hash history never requests new HTML.
 * This does NOT share WebView localStorage with the existing Chrome/TWA build.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const queryClient = new QueryClient();
const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

const mount = document.getElementById("root");
if (!mount) throw new Error("Offline Android mounting element missing");
createRoot(mount).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
