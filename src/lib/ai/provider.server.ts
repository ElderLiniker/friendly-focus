// Camada de IA do TikPrompt. Toda chamada de IA passa por aqui.
// - Gemini (via Lovable AI) é o provedor principal.
// - Para adicionar um provedor de fallback no futuro, implemente outro `TextProvider`
//   e adicione-o em `textProviders` — o resto do sistema não precisa mudar.
// - Cada chamada é registrada na tabela `generations` (base para créditos/limites na fase 2).
import { getDb } from "../db.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const TEXT_MODEL = "google/gemini-3.8-flash";
export const IMAGE_MODEL = "google/gemini-3.1-flash-image";

export class AIError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AIError("A IA não está configurada no servidor (LOVABLE_API_KEY ausente).", 500);
  return key;
}

function friendly(status: number, body: string): AIError {
  if (status === 429) return new AIError("Muitas solicitações à IA agora. Aguarde alguns segundos e tente de novo.", 429);
  if (status === 402) return new AIError("Os créditos de IA do workspace acabaram. Adicione créditos para continuar.", 402);
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

const geminiProvider: TextProvider = {
  name: "lovable-gemini",
  model: TEXT_MODEL,
  async json(system, user, images) {
    const content = images.length
      ? [
          { type: "text", text: user },
          ...images.map((i) => ({ type: "image_url", image_url: { url: i.url } })),
        ]
      : user;
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const text = await res.text();
    if (!res.ok) throw friendly(res.status, text);
    const data = JSON.parse(text);
    const out = data?.choices?.[0]?.message?.content;
    if (!out || typeof out !== "string") throw new AIError("A IA retornou uma resposta vazia.", 502);
    return out;
  },
};

// Ordem de tentativa. Adicione aqui um segundo provedor (fallback) na fase 2.
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
      if (e instanceof AIError && [402, 403].includes(e.status)) throw e;
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
    const content = [
      { type: "text", text: opts.prompt },
      ...(opts.references ?? []).map((r) => ({ type: "image_url", image_url: { url: r.url } })),
    ];
    const res = await fetch(`${GATEWAY}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });
    const text = await res.text();
    if (!res.ok) throw friendly(res.status, text);
    const data = JSON.parse(text);
    const b64: string | undefined = data?.data?.[0]?.b64_json;
    if (!b64) throw new AIError("A IA não retornou nenhuma imagem. Tente ajustar e gerar novamente.", 502);
    await logGeneration({ task: opts.task, model: IMAGE_MODEL, status: "success", duration_ms: Date.now() - t0, project_id: opts.projectId ?? null });
    return { base64: b64, mime: "image/png" };
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
