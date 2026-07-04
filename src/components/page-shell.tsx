import type { ReactNode } from "react";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground max-w-[430px] mx-auto overflow-x-hidden pb-32 relative">
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
    <header className="relative p-6 pt-10 flex justify-between items-end animate-enter">
      <div>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-black tracking-tight leading-none">{title}</h1>
      </div>
      {action}
    </header>
  );
}
