// Acesso ao banco/armazenamento. Sem login na v1: todo acesso passa pelo servidor.
// Na fase 2 (login), troque getDb() pelo cliente autenticado e preencha owner_id.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const BUCKET = "media";

export function getDb() {
  return supabaseAdmin;
}

export async function uploadBase64(base64: string, mime: string, folder: string): Promise<string> {
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { error } = await getDb().storage.from(BUCKET).upload(path, bytes, { contentType: mime });
  if (error) throw new Error(`Falha ao salvar imagem: ${error.message}`);
  return path;
}

/** Converte caminhos do storage em URLs assinadas (bucket privado). URLs externas passam direto. */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const internal = paths.filter((p) => p && !p.startsWith("http"));
  const out: Record<string, string> = {};
  for (const p of paths) if (p?.startsWith("http")) out[p] = p;
  if (internal.length) {
    const { data } = await getDb().storage.from(BUCKET).createSignedUrls(internal, 60 * 60 * 24);
    data?.forEach((d) => {
      if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
    });
  }
  return out;
}

/** Baixa uma imagem (storage ou URL) como data URL para enviar à IA. */
export async function toDataUrl(pathOrUrl: string): Promise<string | null> {
  try {
    let blob: Blob;
    if (pathOrUrl.startsWith("http")) {
      const r = await fetch(pathOrUrl);
      if (!r.ok) return null;
      blob = await r.blob();
    } else {
      const { data, error } = await getDb().storage.from(BUCKET).download(pathOrUrl);
      if (error || !data) return null;
      blob = data;
    }
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}
