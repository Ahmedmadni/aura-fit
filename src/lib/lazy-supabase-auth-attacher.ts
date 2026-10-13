/**
 * Keep Lovable Cloud's Supabase SDK out of the initial application JS.
 * TanStack Start's function middleware only needs the bearer token when a
 * server function is actually invoked. Do not import the generated Supabase
 * client at module load time: it adds the full SDK to index-*.js.
 *
 * Deliberately separate from Lovable's auto-generated auth-attacher.ts.
 */
import { createMiddleware } from "@tanstack/react-start";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
