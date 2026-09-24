// Camada de IA do TikPrompt.
// Provedor principal: Google Gemini usando GEMINI_API_KEY.
// A chave fica somente no servidor (Vercel), nunca no navegador.
import { getDb } from "../db.server";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const TEXT_MODEL = "gemini-2.5-flash";
export const IMAGE_MODEL = "gemini-2.5-flash-image";

export class AIError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function apiKey() {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new AIError("A IA não está configurada no servidor (GEMINI_API_KEY ausente).", 500);
  return key;
}

function friendly(status: number, body: string): AIError {
  if (status === 429) return new AIError("Muitas solicitações à IA agora. Aguarde alguns segundos e tente de novo.", 429);
  if (status === 403) return new AIError("A IA recusou esta solicitação (acesso negado).", 403);
  if (status === 400) return new AIError("A IA não aceitou a solicitação (dados inválidos ou imagem não suportada).", 400);
  return new AIError(`Falha na IA (${status}). ${body.slice(0, 160)}`, status);
}

async function logGeneration(row: {
  task: string;
  model: string;
  status: string;
  error?: string;
  duration_ms: number;
  project_id?: string | null;
}) {
  try {
    await getDb().from("generations").insert(row);
  } catch {
    /* log nunca deve derrubar a geração */
  }
}

export type ImagePart = { url: string }; // data URL ou URL https

type TextProvider = {
  name: string;
  model: string;
  json: (system: string, user: string, images: ImagePart[]) => Promise<string>;
};

async function imageToInlineData(image: ImagePart): Promise<any> {
  if (image.url.startsWith("data:")) {
    const match = image.url.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) throw new AIError("Imagem de referência inválida.", 400);
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }

  const response = await fetch(image.url);
  if (!response.ok) throw new AIError("Não foi possível carregar a imagem de referência.", 400);
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!mimeType.startsWith("image/")) throw new AIError("A referência fornecida não é uma imagem válida.", 400);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { inlineData: { mimeType, data: Buffer.from(binary, "binary").toString("base64") } };
}

async function geminiGenerateContent(opts: {
  model: string;
  system?: string;
  parts: any[];
  responseMimeType?: string;
}) {
  const res = await fetch(
    `${GEMINI_API_BASE}/models/${opts.model}:generateContent?key=${encodeURIComponent(apiKey())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
        contents: [{ role: "user", parts: opts.parts }],
        generationConfig: opts.responseMimeType ? { responseMimeType: opts.responseMimeType } : undefined,
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw friendly(res.status, text);
  try {
    return JSON.parse(text);
  } catch {
    throw new AIError("O Gemini retornou uma resposta inválida.", 502);
  }
}

const geminiProvider: TextProvider = {
  name: "google-gemini",
  model: TEXT_MODEL,
  async json(system, user, images) {
    const imageParts = await Promise.all(images.map(imageToInlineData));
    const data = await geminiGenerateContent({
      model: TEXT_MODEL,
      system,
      parts: [{ text: user }, ...imageParts],
      responseMimeType: "application/json",
    });
    const parts = data?.candidates?.[0]?.content?.parts;
    const out = Array.isArray(parts) ? parts.map((part: any) => part?.text).filter(Boolean).join("") : "";
    if (!out) throw new AIError("A IA retornou uma resposta vazia.", 502);
    return out;
  },
};

const textProviders: TextProvider[] = [geminiProvider];

function parseJSON<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new AIError("A IA retornou uma resposta incompleta. Tente novamente.", 502);
  }
}

export async function aiJSON<T>(opts: {
  task: string;
  system: string;
  user: string;
  images?: ImagePart[];
  projectId?: string | null;
  validate?: (v: T) => string | null; // retorna mensagem de erro se incompleto
}): Promise<T> {
  let lastErr: unknown;
  for (const p of textProviders) {
    const t0 = Date.now();
    try {
      const raw = await p.json(opts.system, opts.user, opts.images ?? []);
      const parsed = parseJSON<T>(raw);
      const invalid = opts.validate?.(parsed);
      if (invalid) throw new AIError(`Resposta incompleta da IA: ${invalid}`, 502);
      await logGeneration({ task: opts.task, model: p.model, status: "success", duration_ms: Date.now() - t0, project_id: opts.projectId ?? null });
      return parsed;
    } catch (e) {
      lastErr = e;
      await logGeneration({
        task: opts.task,
        model: p.model,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
        duration_ms: Date.now() - t0,
        project_id: opts.projectId ?? null,
      });
      // Erros terminais não passam para o próximo provedor
      if (e instanceof AIError && [403].includes(e.status)) throw e;
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new AIError("Falha na IA.");
}

/** Gera uma imagem (PNG base64) a partir de prompt + imagens de referência. */
export async function aiImage(opts: {
  task: string;
  prompt: string;
  references?: ImagePart[];
  projectId?: string | null;
}): Promise<{ base64: string; mime: string }> {
  const t0 = Date.now();
  try {
    const referenceParts = await Promise.all((opts.references ?? []).map(imageToInlineData));
    const data = await geminiGenerateContent({
      model: IMAGE_MODEL,
      parts: [{ text: opts.prompt }, ...referenceParts],
    });
    const parts = data?.candidates?.[0]?.content?.parts;
    const imagePart = Array.isArray(parts) ? parts.find((part: any) => part?.inlineData?.data) : null;
    if (!imagePart?.inlineData?.data) {
      throw new AIError("A IA não retornou nenhuma imagem. Tente ajustar e gerar novamente.", 502);
    }
    const mime = imagePart.inlineData.mimeType || "image/png";
    await logGeneration({ task: opts.task, model: IMAGE_MODEL, status: "success", duration_ms: Date.now() - t0, project_id: opts.projectId ?? null });
    return { base64: imagePart.inlineData.data, mime };
  } catch (e) {
    await logGeneration({
      task: opts.task,
      model: IMAGE_MODEL,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      duration_ms: Date.now() - t0,
      project_id: opts.projectId ?? null,
    });
    throw e;
  }
}
