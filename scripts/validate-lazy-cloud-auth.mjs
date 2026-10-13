// Guard the initial bundle from eager Lovable Cloud Supabase SDK loading.
// Performance budget checks the final generated index-*.js separately.
import fs from "node:fs";

const start = fs.readFileSync("src/start.ts", "utf8");
const middleware = fs.readFileSync("src/lib/lazy-supabase-auth-attacher.ts", "utf8");
const fail = why => { throw new Error("Lazy cloud auth guard FAILED: "+why); };
if (!start.includes('import { attachSupabaseAuth } from "./lib/lazy-supabase-auth-attacher"') ||
    !start.includes("functionMiddleware: [attachSupabaseAuth]")) {
  fail("global TanStack function middleware not bound to lazy auth attacher");
}
if (!middleware.includes('await import("@/integrations/supabase/client")') ||
    !middleware.includes("await supabase.auth.getSession()") ||
    !middleware.includes("Authorization:") ||
    !middleware.includes("token ?")) {
  fail("lazy token bearer attachment must preserve Lovable auth behavior");
}
if (/^import\s+.*(?:@supabase|\/integrations\/supabase\/client).*from/gm.test(middleware) ||
    /^import\s+.*(?:@supabase|\/integrations\/supabase\/auth-attacher)/gm.test(start)) {
  fail("eager Supabase SDK import reintroduced into client entry bundle");
}
console.log("Lazy cloud auth PASS: server-function bearer attachment stays intact without eager Supabase SDK import.");
