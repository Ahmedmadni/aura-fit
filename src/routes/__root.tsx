import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { CloudSyncBridge } from "../components/cloud-sync-bridge";
import { PwaRegister } from "../components/pwa-register";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
          خطأ 404
        </p>
        <h1 className="text-5xl font-black uppercase text-foreground">خارج المسار</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها ليست ضمن البرنامج.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground transition-transform active:scale-95"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const normalized = error instanceof Error ? error : new Error(String(error));
  console.error(normalized);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(normalized, { boundary: "tanstack_root_error_component" });
  }, [normalized]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
          خطأ في النظام
        </p>
        <h1 className="text-3xl font-black uppercase text-foreground">يلزم الاستعادة</h1>
        <p className="mt-2 text-sm text-muted-foreground">حدث خطأ ما، أعد المحاولة.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-widest text-primary-foreground transition-transform active:scale-95"
          >
            إعادة المحاولة
          </button>
          <a
            href="/"
            className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-bold uppercase tracking-widest text-foreground"
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#09090b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "كينيتك" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "كينيتك — منصة اللياقة المنزلية بالذكاء الاصطناعي" },

      {
        name: "description",
        content:
          "منصة لياقة منزلية بالذكاء الاصطناعي. برامج تدريبية مخصصة، متابعة الاستشفاء، وتطور مستمر مبني على جسدك وأهدافك وأسلوب حياتك.",
      },
      { name: "author", content: "Kinetic" },
      {
        property: "og:title",
        content: "كينيتك — منصة اللياقة المنزلية بالذكاء الاصطناعي",
      },
      {
        property: "og:description",
        content: "مدربك الشخصي بالذكاء الاصطناعي. تمارين متكيفة، تحليلات دقيقة، وبرامج تطورية للتدريب المنزلي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap",
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('kp-font-scale');if(s)document.documentElement.style.setProperty('--font-scale',s)}catch(e){}",
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          تخطي إلى المحتوى الرئيسي
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <PwaRegister />
      <CloudSyncBridge />
      <Outlet />
    </QueryClientProvider>
  );
}
