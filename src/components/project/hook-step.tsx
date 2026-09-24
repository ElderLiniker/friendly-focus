import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { listHookLibrary, markHookUsed } from "@/lib/hooks.functions";
import { generateHooks } from "@/lib/generate.functions";
import type { Hook } from "@/lib/constants";
import { Chip, Section, Spin, useProjectActions, useRun, view, type PData } from "./shared";

export function HookStep({ d, onNext }: { d: PData; onNext: () => void }) {
  const { hook } = view(d);
  const { save } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const gen = useServerFn(generateHooks);
  const lib = useQuery({ queryKey: ["hooks-library"], queryFn: () => listHookLibrary() });
  const [cat, setCat] = useState<string>("");
  const [options, setOptions] = useState<Hook[]>([]);
  const [chosen, setChosen] = useState<Hook | null>(hook);
  const [libraryHookId, setLibraryHookId] = useState<string | null>(null);

  const catName = lib.data?.categories.find((c) => c.id === cat)?.name;
  const hooks = useMemo(
    () => (lib.data?.hooks ?? []).filter((h) => !cat || h.category_id === cat).sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite)),
    [lib.data, cat],
  );

  const generate = (opts: { category?: string; template?: string }) =>
    run("gen", async () => {
      const r = await gen({ data: { projectId: d.project.id, ...opts, count: 5 } });
      setOptions(r);
    });

  const proceed = (h: Hook | null) =>
    run("save", async () => {
      await save({ hook: h, current_step: "influencer" });
      if (h && libraryHookId) await markHookUsed({ data: { id: libraryHookId } });
      onNext();
    });

  return (
    <div className="space-y-5">
      <Section
        title="Escolha o gancho"
        desc="Escolha uma estrutura da biblioteca — a IA adapta ao seu produto. Ou deixe a IA escolher."
        actions={
          <Button variant="secondary" size="sm" disabled={busy === "gen"} onClick={() => generate({ category: catName })}>
            <Spin on={busy === "gen"}><Sparkles className="h-4 w-4" /> Gerar novas opções</Spin>
          </Button>
        }
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Chip active={!cat} onClick={() => setCat("")}>Todas</Chip>
          {lib.data?.categories.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              <span className="whitespace-nowrap">{c.name}</span>
            </Chip>
          ))}
        </div>

        {options.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Adaptados ao seu produto</p>
            {options.map((o, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChosen(o)}
                className={`block w-full rounded-xl border p-3 text-left text-sm ${chosen?.text === o.text ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40"}`}
              >
                <span className="text-xs text-muted-foreground">{o.category}</span>
                <p className="font-medium">"{o.text}"</p>
              </button>
            ))}
          </div>
        )}

        <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
          {lib.isLoading && <p className="text-sm text-muted-foreground">Carregando biblioteca...</p>}
          {hooks.map((h) => (
            <button
              key={h.id}
              type="button"
              disabled={busy === "gen"}
              onClick={() => { setLibraryHookId(h.id); generate({ template: h.template }); }}
              className="flex items-start gap-2 rounded-xl border border-border p-3 text-left text-sm hover:border-primary"
              title="Adaptar ao produto"
            >
              {h.is_favorite && <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
              <span>{h.template}</span>
            </button>
          ))}
        </div>
      </Section>

      {chosen && (
        <Section title="Gancho escolhido" desc="Você pode ajustar o texto.">
          <Textarea value={chosen.text} onChange={(e) => setChosen({ ...chosen, text: e.target.value })} rows={2} maxLength={400} />
        </Section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={!chosen?.text.trim() || busy === "save"} onClick={() => proceed(chosen)}>
          <Spin on={busy === "save"}>Usar este gancho</Spin>
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" disabled={busy === "save"} onClick={() => proceed(null)}>
          Deixar a IA escolher
        </Button>
      </div>
    </div>
  );
}
