import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Pencil, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUploader, type Uploaded } from "@/components/image-uploader";
import { addProductImages, reanalyzeProduct, updateProductAnalysis } from "@/lib/products.functions";
import type { ProductAnalysis } from "@/lib/constants";
import { Section, Spin, useProjectActions, useRun, view, type PData } from "./shared";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function AnalysisStep({ d, onNext, onAuto }: { d: PData; onNext: () => void; onAuto: () => void }) {
  const { analysis } = view(d);
  const { refresh } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const saveAnalysis = useServerFn(updateProductAnalysis);
  const reanalyze = useServerFn(reanalyzeProduct);
  const addImages = useServerFn(addProductImages);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProductAnalysis | null>(analysis);
  const [newImgs, setNewImgs] = useState<Uploaded[]>([]);
  const [desc, setDesc] = useState(d.product?.description ?? "");
  const [showMore, setShowMore] = useState(false);

  if (!analysis || !d.product) return <p className="text-muted-foreground">Produto sem análise.</p>;

  const insufficient = analysis.sufficient === false;

  return (
    <div className="space-y-5">
      <Section
        title={analysis.name || "Produto"}
        desc={analysis.category}
        actions={
          !editing && (
            <Button variant="outline" size="sm" onClick={() => { setDraft(analysis); setEditing(true); }}>
              <Pencil className="h-4 w-4" /> Editar informações do produto
            </Button>
          )
        }
      >
        {d.product.image_signed.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {d.product.image_signed.map((u) => (
              <img key={u} src={u} alt="Produto" className="h-24 w-24 shrink-0 rounded-xl border border-border object-cover" />
            ))}
          </div>
        )}
        {insufficient && (
          <div className="flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            Informações insuficientes para um criativo confiável. Adicione uma imagem ou descrição abaixo.
          </div>
        )}

        {editing && draft ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Categoria</Label><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Resumo</Label><Textarea rows={2} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
            {(["features", "benefits", "confirmed", "unknown"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label>{{ features: "Características", benefits: "Benefícios", confirmed: "Informações confirmadas", unknown: "Não identificadas" }[k]} (uma por linha)</Label>
                <Textarea rows={4} value={draft[k].join("\n")} onChange={(e) => setDraft({ ...draft, [k]: lines(e.target.value) })} />
              </div>
            ))}
            <div className="space-y-1.5"><Label>Público provável</Label><Input value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Aparência do produto</Label><Textarea rows={2} value={draft.visual_identity} onChange={(e) => setDraft({ ...draft, visual_identity: e.target.value })} /></div>
            <div className="flex gap-2 md:col-span-2">
              <Button
                disabled={busy === "save" || !draft.name.trim()}
                onClick={() =>
                  run("save", async () => {
                    await saveAnalysis({ data: { productId: d.product!.id, analysis: { ...draft, sufficient: true } } });
                    await refresh();
                    setEditing(false);
                  }, "Informações salvas")
                }
              >
                <Spin on={busy === "save"}>Salvar</Spin>
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-sm text-muted-foreground md:col-span-2">{analysis.summary}</p>
            <List title="Características identificadas" items={analysis.features} />
            <List title="Benefícios identificados" items={analysis.benefits} />
            <div className="rounded-2xl bg-secondary/60 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Público provável</p>
              <p className="text-sm">{analysis.audience || "—"}</p>
            </div>
            <List title="Informações confirmadas" items={analysis.confirmed} icon="ok" />
            <List title="Não foi possível identificar" items={analysis.unknown} icon="warn" />
          </div>
        )}
      </Section>

      <Section
        title="Complementar produto"
        desc="Adicione fotos ou descrição e reanalise para resultados mais fiéis."
        actions={<Button variant="ghost" size="sm" onClick={() => setShowMore((v) => !v)}>{showMore ? "Fechar" : "Abrir"}</Button>}
      >
        {showMore && (
          <div className="space-y-3">
            <ImageUploader value={newImgs} onChange={setNewImgs} />
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição do produto" maxLength={5000} />
            <Button
              variant="secondary"
              disabled={busy === "re"}
              onClick={() =>
                run("re", async () => {
                  if (newImgs.length) await addImages({ data: { productId: d.product!.id, paths: newImgs.map((i) => i.path) } });
                  await reanalyze({ data: { productId: d.product!.id, description: desc || undefined } });
                  setNewImgs([]);
                  await refresh();
                }, "Produto reanalisado")
              }
            >
              <Spin on={busy === "re"}><RefreshCw className="h-4 w-4" /> Reanalisar produto</Spin>
            </Button>
          </div>
        )}
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={onNext}>Escolher o que criar</Button>
        <Button size="lg" variant="secondary" className="flex-1" onClick={onAuto}>
          <Wand2 className="h-4 w-4" /> Criativo automático
        </Button>
      </div>
    </div>
  );
}

function List({ title, items, icon }: { title: string; items: string[]; icon?: "ok" | "warn" }) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((i) => (
            <li key={i} className="flex gap-2">
              {icon === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : icon === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <span className="text-primary">•</span>}
              <span>{i}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
