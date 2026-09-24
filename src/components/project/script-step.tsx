import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateScript } from "@/lib/generate.functions";
import { DURATIONS, TONES, VIDEO_STYLES, OBJECTIVES, type Script } from "@/lib/constants";
import { Section, Spin, useProjectActions, useRun, view, type PData } from "./shared";

export const SCRIPT_PARTS: { key: keyof Script; label: string }[] = [
  { key: "hook", label: "Gancho" },
  { key: "development", label: "Desenvolvimento" },
  { key: "demonstration", label: "Demonstração / explicação" },
  { key: "benefit", label: "Benefício confirmado" },
  { key: "cta", label: "CTA" },
];

export function ScriptStep({ d, onNext }: { d: PData; onNext: () => void }) {
  const v = view(d);
  const { save, refresh } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const gen = useServerFn(generateScript);
  const [settings, setSettings] = useState(v.settings);
  const [draft, setDraft] = useState<Script | null>(v.script);
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(v.script), [d.project.script]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = () =>
    run("gen", async () => {
      await save({ settings });
      await gen({ data: { projectId: d.project.id } });
      await refresh();
      setEditing(false);
    });

  return (
    <div className="space-y-5">
      <Section title="Configurar roteiro">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Duração">
            <Select value={String(settings.duration ?? 15)} onValueChange={(x) => setSettings({ ...settings, duration: Number(x) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DURATIONS.map((n) => <SelectItem key={n} value={String(n)}>{n} segundos</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Estilo">
            <Select value={settings.style ?? "auto"} onValueChange={(x) => setSettings({ ...settings, style: x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">IA recomenda</SelectItem>
                {VIDEO_STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Objetivo">
            <Select value={settings.objective ?? "auto"} onValueChange={(x) => setSettings({ ...settings, objective: x === "auto" ? undefined : x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">IA escolhe</SelectItem>
                {OBJECTIVES.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tom">
            <Select value={settings.tone ?? "Natural"} onValueChange={(x) => setSettings({ ...settings, tone: x })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">
          Gancho: {v.hook?.text ? `"${v.hook.text}"` : "IA escolhe"} · Influencer: {d.influencer?.name ?? "nenhum"}
        </p>
        <Button onClick={generate} disabled={busy === "gen"} variant={draft ? "secondary" : "default"}>
          <Spin on={busy === "gen"}>{draft ? <><RefreshCw className="h-4 w-4" /> Regenerar</> : <><Sparkles className="h-4 w-4" /> Gerar roteiro</>}</Spin>
        </Button>
      </Section>

      {v.strategy && (
        <Section title="Estratégia escolhida">
          <p className="text-sm"><b>{v.strategy.style}</b> · {v.strategy.objective}</p>
          <p className="text-sm text-muted-foreground">{v.strategy.approach}</p>
        </Section>
      )}

      {draft && (
        <Section
          title="Roteiro"
          actions={!editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</Button>}
        >
          <div className="space-y-3">
            {SCRIPT_PARTS.map((p, i) => (
              <div key={p.key} className="relative border-l-2 border-primary/50 pl-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{i + 1}. {p.label}</p>
                {editing ? (
                  <Textarea rows={2} value={draft[p.key]} onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value })} className="mt-1" />
                ) : (
                  <p className="mt-1 text-sm">{draft[p.key]}</p>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className="flex gap-2">
              <Button disabled={busy === "save"} onClick={() => run("save", async () => { await save({ script: draft }); setEditing(false); }, "Roteiro salvo")}>
                <Spin on={busy === "save"}>Salvar roteiro</Spin>
              </Button>
              <Button variant="ghost" onClick={() => { setDraft(v.script); setEditing(false); }}>Cancelar</Button>
            </div>
          )}
        </Section>
      )}

      {draft && !editing && (
        <Button size="lg" className="w-full" onClick={() => run("n", async () => { await save({ current_step: "video" }); onNext(); })}>
          Continuar para prompts
        </Button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
