import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-background text-foreground max-w-[430px] mx-auto overflow-x-hidden pb-32 relative"
      style={{
        minHeight: "100dvh",
        paddingBottom: "calc(8rem + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="pointer-events-none absolute -top-32 -right-24 size-72 rounded-full bg-primary/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-96 -left-24 size-72 rounded-full bg-cyan/10 blur-[100px]"
        aria-hidden
      />
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header
      className="relative p-6 pt-10 flex justify-between items-end animate-enter"
      style={{ paddingTop: "max(2.5rem, calc(1rem + env(safe-area-inset-top)))" }}
    >
      <div>
        <p className="type-eyebrow text-muted-foreground mb-2">
          {eyebrow}
        </p>
        <h1 className="type-page-title text-foreground">{title}</h1>
      </div>
      {action}
    </header>
  );
}
