import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getProject, updateProject } from "@/lib/projects.functions";
import { errMsg } from "@/lib/client-utils";
import type { Hook, ProductAnalysis, ProjectSettings, Scene, Script, Strategy } from "@/lib/constants";

export const STEPS = [
  { id: "analysis", label: "Análise" },
  { id: "objective", label: "Objetivo" },
  { id: "hook", label: "Gancho" },
  { id: "influencer", label: "Influencer" },
  { id: "script", label: "Roteiro" },
  { id: "video", label: "Cenas" },
  { id: "result", label: "Resultado" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export const projectQuery = (id: string) =>
  queryOptions({ queryKey: ["project", id], queryFn: () => getProject({ data: { id } }) });

export type PData = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export function view(d: PData) {
  const p = d.project;
  return {
    settings: (p.settings ?? {}) as ProjectSettings,
    analysis: (d.product?.analysis ?? null) as ProductAnalysis | null,
    hook: p.hook as Hook | null,
    script: p.script as Script | null,
    strategy: p.strategy as Strategy | null,
    scenes: (p.scenes ?? []) as Scene[],
  };
}

type Patch = Parameters<typeof updateProject>[0]["data"]["patch"];

export function useProjectActions(id: string) {
  const qc = useQueryClient();
  const update = useServerFn(updateProject);
  const refresh = () => qc.invalidateQueries({ queryKey: ["project", id] });
  const save = async (patch: Patch) => {
    await update({ data: { id, patch } });
    await refresh();
  };
  return { save, refresh };
}

/** Executa uma ação assíncrona mostrando loading e erro claro (nunca finge sucesso). */
export function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <T,>(key: string, fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      return r;
    } catch (e) {
      toast.error(errMsg(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

export function Spin({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <>
      {on && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </>
  );
}

export function Section({ title, desc, children, actions }: { title: string; desc?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
        active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
