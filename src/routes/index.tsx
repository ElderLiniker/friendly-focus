import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { FileText, Link2, Loader2, Sparkles, Wand2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUploader, type Uploaded } from "@/components/image-uploader";
import { analyzeProduct } from "@/lib/products.functions";
import { errMsg } from "@/lib/client-utils";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ hook: z.string().uuid().optional(), hookText: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Criar novo conteúdo — TikPrompt" },
      { name: "description", content: "Cole o link, imagem ou descrição do produto e gere um criativo completo para TikTok Shop." },
      { property: "og:title", content: "TikPrompt — Criativos para TikTok Shop com IA" },
      { property: "og:description", content: "Do produto ao roteiro, prompts de vídeo, legenda e hashtags em minutos." },
    ],
  }),
  component: Index,
});

function Index() {
  const { hook, hookText } = Route.useSearch();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeProduct);
  const [link, setLink] = useState("");
  const [images, setImages] = useState<Uploaded[]>([]);
  const [showDesc, setShowDesc] = useState(false);
  const [showImg, setShowImg] = useState(false);
  const [description, setDescription] = useState("");
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = link.trim() || description.trim() || images.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return toast.error("Informe um link, uma imagem ou uma descrição do produto.");
    if (link.trim() && !/^https?:\/\/.+\..+/i.test(link.trim())) return toast.error("Link inválido. Cole o endereço completo (https://...).");
    setBusy(true);
    try {
      const r = await analyze({
        data: { link: link.trim(), description: description.trim() || undefined, imagePaths: images.map((i) => i.path), autoMode: auto, hookId: hook },
      });
      navigate({ to: "/projeto/$id", params: { id: r.projectId } });
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Produto → criativo completo
        </p>
        <h1 className="text-3xl font-extrabold md:text-5xl">
          Criar novo <span className="text-brand">conteúdo</span>
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Análise, gancho, roteiro, prompts de vídeo por cena, imagens, legenda e hashtags — sem inventar nada sobre o seu produto.
        </p>
      </section>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-border bg-card p-5 md:p-7">
        {hook && (
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">
            <Zap className="h-4 w-4 text-accent" /> Gancho selecionado: <span className="font-medium">"{hookText}"</span>
          </div>
        )}
        <div className="relative">
          <Link2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Cole o link do produto"
            className="h-14 rounded-2xl pl-12 text-base"
            inputMode="url"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={showImg || images.length ? "secondary" : "outline"} size="sm" onClick={() => setShowImg((v) => !v)}>
            Adicionar imagem {images.length ? `(${images.length})` : ""}
          </Button>
          <Button type="button" variant={showDesc ? "secondary" : "outline"} size="sm" onClick={() => setShowDesc((v) => !v)}>
            <FileText className="h-4 w-4" /> Adicionar descrição
          </Button>
        </div>

        {(showImg || images.length > 0) && <ImageUploader value={images} onChange={setImages} />}
        {showDesc && (
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o produto: o que é, para que serve, o que vem na embalagem..."
            rows={4}
            maxLength={5000}
          />
        )}

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border p-4">
          <span>
            <span className="flex items-center gap-2 font-medium">
              <Wand2 className="h-4 w-4 text-accent" /> Criativo automático
            </span>
            <span className="text-sm text-muted-foreground">O TikPrompt escolhe objetivo, gancho, estilo, estrutura e CTA por você.</span>
          </span>
          <Switch checked={auto} onCheckedChange={setAuto} />
        </label>

        <Button type="submit" size="lg" disabled={busy || !canSubmit} className="h-14 w-full rounded-2xl bg-brand text-base font-semibold shadow-glow">
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Analisando produto...
            </>
          ) : (
            "Analisar produto"
          )}
        </Button>
      </form>

      <section className="grid gap-3 sm:grid-cols-4">
        {["Produto", "Objetivo e gancho", "Roteiro e cenas", "Legenda e hashtags"].map((t, i) => (
          <div key={t} className="rounded-2xl border border-border p-4">
            <span className="font-display text-2xl font-bold text-primary">{i + 1}</span>
            <p className="mt-1 text-sm text-muted-foreground">{t}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
