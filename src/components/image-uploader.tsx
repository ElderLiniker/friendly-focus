import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { uploadImage } from "@/lib/products.functions";
import { errMsg, fileToDataUrl } from "@/lib/client-utils";

export type Uploaded = { path: string; url: string };

export function ImageUploader({
  value,
  onChange,
  max = 4,
  folder = "uploads",
  label = "Adicionar imagem",
}: {
  value: Uploaded[];
  onChange: (v: Uploaded[]) => void;
  max?: number;
  folder?: "uploads" | "references";
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = useServerFn(uploadImage);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const next = [...value];
    try {
      for (const f of Array.from(files).slice(0, max - value.length)) {
        const dataUrl = await fileToDataUrl(f);
        next.push(await upload({ data: { dataUrl, folder } }));
      }
      onChange(next);
    } catch (e) {
      toast.error(errMsg(e));
      onChange(next);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {value.map((img) => (
        <div key={img.path} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
          <img src={img.url} alt="Imagem do produto" className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label="Remover imagem"
            onClick={() => onChange(value.filter((v) => v.path !== img.path))}
            className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex h-20 min-w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {busy ? "Enviando..." : label}
        </button>
      )}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}
