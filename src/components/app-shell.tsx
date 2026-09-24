import { Link } from "@tanstack/react-router";
import { FolderKanban, Plus, Sparkles, Users, Zap } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Criar", icon: Plus },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/influencers", label: "Influencers", icon: Users },
  { to: "/ganchos", label: "Ganchos", icon: Zap },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-bold">TikPrompt</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-foreground"
            >
              <Icon className="h-4 w-4" />
              {label === "Criar" ? "Criar conteúdo" : label === "Projetos" ? "Meus projetos" : label === "Influencers" ? "Meus influencers" : "Biblioteca de ganchos"}
            </Link>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-muted-foreground">Criativos para TikTok Shop com IA</p>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </span>
        <span className="font-display text-lg font-bold">TikPrompt</span>
      </header>

      <main className="pb-24 md:pb-10 md:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground data-[status=active]:text-primary"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
