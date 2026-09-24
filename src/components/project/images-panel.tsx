import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IMAGE_KINDS } from "@/lib/constants";
import { deleteGeneratedImage, generateProductImage } from "@/lib/images.functions";
import { listInfluencers } from "@/lib/influencers.functions";
import { Section, Spin, useProjectActions, useRun, type PData } from "./shared";

export function ImagesPanel({ d }: { d: PData }) {
  const { refresh } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const gen = useServerFn(generateProductImage);
  const del = useServerFn(deleteGeneratedImage);
  const infs = useQuery({ queryKey: ["influencers"], queryFn: () => listInfluencers() });
  const [kind, setKind] = useState<string>(d.project.influencer_id ? "holding" : "scene");
  const [inf, setInf] = useState<string>(d.project.influencer_id ?? "none");
  const [extra, setExtra] = useState("");
  const needsInf = IMAGE_KINDS.find((k) => k.id === kind)?.needsInfluencer;
  const noProductPhoto = (d.product?.image_urls.length ?? 0) === 0;

  return (
    <Section title="Imagens do produto" desc="As imagens respeitam embalagem, formato, cores e logotipo do produto real enviado.">
      {noProductPhoto && (
        <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">Sem foto do produto: adicione uma na etapa Análise para imagens fiéis.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{IMAGE_KINDS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Influencer {needsInf && <span className="text-primary">*</span>}</Label>
          <Select value={inf} onValueChange={setInf}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {infs.data?.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Detalhe extra (opcional)</Label>
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="ex.: cozinha clara" maxLength={400} />
        </div>
      </div>
      <Button
        disabled={busy === "gen" || (needsInf && inf === "none")}
        onClick={() =>
          run("gen", async () => {
            await gen({ data: { projectId: d.project.id, kind, influencerId: inf === "none" ? null : inf, extra: extra || undefined } });
            await refresh();
          }, "Imagem gerada")
        }
      >
        <Spin on={busy === "gen"}><ImageIcon className="h-4 w-4" /> {busy === "gen" ? "Gerando imagem..." : "Gerar imagem"}</Spin>
      </Button>
      {needsInf && inf === "none" && <p className="text-xs text-muted-foreground">Este tipo precisa de um influencer salvo.</p>}

      {d.images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {d.images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-2xl border border-border">
              <img src={img.signed} alt={img.kind} className="aspect-[9/16] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-background/80 p-1.5">
                <span className="truncate px-1 text-xs">{IMAGE_KINDS.find((k) => k.id === img.kind)?.label}</span>
                <div className="flex gap-1">
                  <a href={img.signed} target="_blank" rel="noreferrer" download className="rounded-md p-1 hover:bg-secondary" aria-label="Baixar">
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    aria-label="Excluir"
                    className="rounded-md p-1 hover:bg-secondary"
                    onClick={() => run("del" + img.id, async () => { await del({ data: { id: img.id } }); await refresh(); })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
