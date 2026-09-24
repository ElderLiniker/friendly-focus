import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Layers, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton } from "@/components/copy-button";
import { generateCaption, generateHashtags, generateVariations, regenerateScene } from "@/lib/generate.functions";
import { MAX_PROMPT_CHARS, type Scene } from "@/lib/constants";
import { Section, Spin, useProjectActions, useRun, view, type PData } from "./shared";
import { SCRIPT_PARTS } from "./script-step";
import { PIPELINE_STEPS, usePipeline } from "./pipeline";
import { ProgressSteps } from "./progress-steps";
import { ImagesPanel } from "./images-panel";

export function ResultStep({ d }: { d: PData }) {
  const v = view(d);
  const { save, refresh } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const regenScene = useServerFn(regenerateScene);
  const genCaption = useServerFn(generateCaption);
  const genTags = useServerFn(generateHashtags);
  const genVars = useServerFn(generateVariations);
  const pipe = usePipeline(d.project.id);
  const limit = v.settings.destination === "generic" ? null : MAX_PROMPT_CHARS;

  const allText = [
    v.hook?.text && `GANCHO\n${v.hook.text}`,
    ...v.scenes.map((s) => `CENA ${s.index} (${s.duration}s)\n${s.prompt}`),
    d.project.caption && `LEGENDA\n${d.project.caption}`,
    d.project.hashtags.length && `HASHTAGS\n${d.project.hashtags.join(" ")}`,
  ].filter(Boolean).join("\n\n");

  if (pipe.step >= 0 && (pipe.running || pipe.error)) {
    return (
      <div className="space-y-4">
        <ProgressSteps steps={PIPELINE_STEPS} current={pipe.step} error={pipe.error} />
        {pipe.error && <Button onClick={pipe.reset}>Voltar</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => run("all", async () => { await pipe.start(true); await refresh(); pipe.reset(); })}>
          <RefreshCw className="h-4 w-4" /> Regenerar tudo
        </Button>
        <Button
          variant="secondary"
          disabled={busy === "vars"}
          onClick={() => run("vars", async () => { await genVars({ data: { projectId: d.project.id } }); await refresh(); }, "3 novas versões criadas")}
        >
          <Spin on={busy === "vars"}><Layers className="h-4 w-4" /> Gerar 3 novas versões</Spin>
        </Button>
        {allText && <CopyButton text={allText} label="Copiar tudo" size="default" />}
      </div>

      {d.variations.length > 0 && (
        <Section title="Variações para teste" desc="Cada versão tem roteiro próprio. Abra para gerar as cenas.">
          <div className="grid gap-2 sm:grid-cols-3">
            {d.variations.map((x) => (
              <Link key={x.id} to="/projeto/$id" params={{ id: x.id }} className="rounded-2xl border border-border p-3 text-sm hover:border-primary">
                <p className="font-medium">{x.title.split("—").pop()}</p>
                <p className="mt-1 text-muted-foreground">"{(x.hook as { text?: string } | null)?.text}"</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {v.strategy && (
        <Section title="Estratégia escolhida">
          <p className="text-sm"><b>{v.strategy.style}</b> · {v.strategy.objective}</p>
          <p className="text-sm text-muted-foreground">{v.strategy.approach}</p>
        </Section>
      )}

      {v.hook && (
        <Section title="Gancho" actions={<CopyButton text={v.hook.text} />}>
          <p className="text-lg font-semibold">"{v.hook.text}"</p>
        </Section>
      )}

      {v.script && (
        <Section title="Roteiro">
          <div className="space-y-2">
            {SCRIPT_PARTS.map((p) => (
              <p key={p.key} className="text-sm"><span className="font-semibold text-primary">{p.label}:</span> {v.script![p.key]}</p>
            ))}
          </div>
        </Section>
      )}

      {v.scenes.length === 0 && <p className="text-muted-foreground">Nenhuma cena gerada ainda.</p>}
      {v.scenes.map((s) => (
        <SceneCard
          key={s.index}
          scene={s}
          limit={limit}
          regenerating={busy === `scene${s.index}`}
          onRegenerate={() => run(`scene${s.index}`, async () => { await regenScene({ data: { projectId: d.project.id, index: s.index } }); await refresh(); }, `Cena ${s.index} regenerada`)}
          onSave={(prompt) => run("save", () => save({ scenes: v.scenes.map((x) => (x.index === s.index ? { ...x, prompt } : x)) }), "Cena salva")}
        />
      ))}

      <Section
        title="Legenda e CTA"
        actions={
          <Button size="sm" variant="secondary" disabled={busy === "cap"} onClick={() => run("cap", async () => { await genCaption({ data: { projectId: d.project.id } }); await refresh(); })}>
            <Spin on={busy === "cap"}><RefreshCw className="h-4 w-4" /> Regenerar legenda</Spin>
          </Button>
        }
      >
        <EditableText value={d.project.caption ?? ""} onSave={(caption) => run("save", () => save({ caption }), "Legenda salva")} />
        {d.project.cta && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-3 text-sm">
            <span><b>CTA:</b> {d.project.cta}</span>
            <CopyButton text={d.project.cta} />
          </div>
        )}
      </Section>

      <Section
        title="Hashtags"
        desc="No máximo 5, todas relacionadas ao produto."
        actions={
          <div className="flex gap-2">
            {d.project.hashtags.length > 0 && <CopyButton text={d.project.hashtags.join(" ")} />}
            <Button size="sm" variant="secondary" disabled={busy === "tags"} onClick={() => run("tags", async () => { await genTags({ data: { projectId: d.project.id } }); await refresh(); })}>
              <Spin on={busy === "tags"}><RefreshCw className="h-4 w-4" /> Regenerar</Spin>
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {d.project.hashtags.map((h) => <span key={h} className="rounded-full bg-accent/15 px-3 py-1 text-sm text-accent">{h}</span>)}
          {d.project.hashtags.length === 0 && <span className="text-sm text-muted-foreground">Nenhuma hashtag ainda.</span>}
        </div>
      </Section>

      <ImagesPanel d={d} />
    </div>
  );
}

function SceneCard({ scene, limit, regenerating, onRegenerate, onSave }: { scene: Scene; limit: number | null; regenerating: boolean; onRegenerate: () => void; onSave: (p: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(scene.prompt);
  const len = (editing ? text : scene.prompt).length;
  const over = limit !== null && len > limit;
  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm text-primary-foreground">{scene.index}</span>
          CENA {scene.index} <span className="text-sm font-normal text-muted-foreground">· {scene.duration}s</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={scene.prompt} label="Copiar prompt" />
          <Button size="sm" variant="outline" onClick={() => { setText(scene.prompt); setEditing((e) => !e); }}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button size="sm" variant="outline" disabled={regenerating} onClick={onRegenerate}>
            <Spin on={regenerating}><Sparkles className="h-4 w-4" /> Regenerar cena</Spin>
          </Button>
        </div>
      </div>
      {scene.narration && <p className="text-sm"><span className="text-muted-foreground">Fala:</span> "{scene.narration}"</p>}
      {editing ? (
        <>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
          <div className="flex gap-2">
            <Button size="sm" disabled={over} onClick={() => { onSave(text); setEditing(false); }}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </>
      ) : (
        <pre className="whitespace-pre-wrap rounded-2xl bg-secondary/70 p-4 font-mono text-xs leading-relaxed">{scene.prompt}</pre>
      )}
      <p className={`text-right text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
        <Copy className="mr-1 inline h-3 w-3" />{len}{limit ? ` / ${limit}` : ""} caracteres{over ? " — acima do limite" : ""}
      </p>
    </section>
  );
}

function EditableText({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(value);
  if (!editing)
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap text-sm">{value || <span className="text-muted-foreground">Sem legenda ainda.</span>}</p>
        <div className="flex gap-2">
          {value && <CopyButton text={value} />}
          <Button size="sm" variant="outline" onClick={() => { setT(value); setEditing(true); }}><Pencil className="h-4 w-4" /> Editar</Button>
        </div>
      </div>
    );
  return (
    <div className="space-y-2">
      <Textarea rows={4} value={t} onChange={(e) => setT(e.target.value)} maxLength={2200} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { onSave(t); setEditing(false); }}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
