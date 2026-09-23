import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb, signPaths, toDataUrl, uploadBase64 } from "./db.server";
import { aiJSON } from "./ai/provider.server";
import { ANALYZE_SYSTEM } from "./ai/prompts.server";
import type { ProductAnalysis, ProjectSettings } from "./constants";

const MAX_IMAGE_BYTES = 7 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ dataUrl: z.string().min(20), folder: z.enum(["uploads", "references"]) }).parse(d))
  .handler(async ({ data }) => {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(data.dataUrl);
    if (!m) throw new Error("Imagem inválida. Use PNG, JPG ou WEBP.");
    const mime = m[1].toLowerCase();
    if (!ALLOWED.includes(mime)) throw new Error("Formato de imagem não suportado. Use PNG, JPG ou WEBP.");
    const b64 = m[2];
    if ((b64.length * 3) / 4 > MAX_IMAGE_BYTES) throw new Error("Imagem muito grande (máx. 7 MB).");
    const path = await uploadBase64(b64, mime, data.folder);
    const signed = await signPaths([path]);
    return { path, url: signed[path] };
  });

function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractPage(url: string): Promise<{ text: string; image: string | null }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TikPromptBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Não foi possível acessar o link (tempo esgotado ou site indisponível).");
  }
  if (!res.ok) throw new Error(`O site respondeu com erro ${res.status}. Adicione uma imagem ou descrição do produto.`);
  const html = (await res.text()).slice(0, 600_000);
  const meta = (name: string) =>
    new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1] ??
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i").exec(html)?.[1];
  const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1];
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((s) => /product/i.test(s))
    .join("\n")
    .slice(0, 4000);
  const parts = [
    title && `Título: ${title}`,
    meta("og:title") && `og:title: ${meta("og:title")}`,
    meta("description") && `Descrição: ${meta("description")}`,
    meta("og:description") && `og:description: ${meta("og:description")}`,
    jsonLd && `Dados estruturados: ${jsonLd}`,
    `Texto da página: ${stripTags(html).slice(0, 5000)}`,
  ].filter(Boolean);
  return { text: parts.join("\n"), image: meta("og:image") ?? null };
}

const AnalyzeInput = z
  .object({
    link: z.string().trim().url("Link inválido").refine((u) => /^https?:\/\//i.test(u), "Link inválido").optional().or(z.literal("")),
    description: z.string().trim().max(5000).optional(),
    imagePaths: z.array(z.string()).max(4).default([]),
    autoMode: z.boolean().default(false),
    hookId: z.string().uuid().optional(),
  })
  .refine((d) => d.link || d.description || d.imagePaths.length, "Informe um link, uma imagem ou uma descrição do produto.");

function validAnalysis(a: ProductAnalysis) {
  if (!a || typeof a !== "object") return "formato";
  if (typeof a.name !== "string") return "nome";
  for (const k of ["features", "benefits", "confirmed", "unknown"] as const) if (!Array.isArray(a[k])) (a as Record<string, unknown>)[k] = [];
  return null;
}

async function runAnalysis(input: { link?: string; description?: string; imagePaths: string[] }) {
  let pageText = "";
  const images: { url: string }[] = [];
  let pageWarning: string | null = null;
  if (input.link) {
    try {
      const page = await extractPage(input.link);
      pageText = page.text;
      if (page.image && input.imagePaths.length === 0) {
        const d = await toDataUrl(page.image);
        if (d) images.push({ url: d });
      }
    } catch (e) {
      pageWarning = e instanceof Error ? e.message : "Falha ao ler o link.";
      if (!input.description && input.imagePaths.length === 0) throw new Error(pageWarning);
    }
  }
  for (const p of input.imagePaths) {
    const d = await toDataUrl(p);
    if (!d) throw new Error("Não foi possível ler uma das imagens enviadas.");
    images.push({ url: d });
  }
  const user = [
    input.link && `Link: ${input.link}`,
    pageText && `CONTEÚDO EXTRAÍDO DO LINK:\n${pageText}`,
    input.description && `DESCRIÇÃO DO USUÁRIO:\n${input.description}`,
    images.length ? `${images.length} imagem(ns) do produto anexada(s).` : "Sem imagens.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const analysis = await aiJSON<ProductAnalysis>({ task: "analyze_product", system: ANALYZE_SYSTEM, user, images, validate: validAnalysis });
  if (pageWarning) analysis.unknown = [`Aviso: ${pageWarning}`, ...analysis.unknown];
  return { analysis, pageText };
}

export const analyzeProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }) => {
    const link = data.link || undefined;
    const { analysis, pageText } = await runAnalysis({ link, description: data.description, imagePaths: data.imagePaths });
    if (analysis.sufficient === false && !analysis.name) {
      throw new Error("Não há informações suficientes para identificar o produto. Adicione uma imagem ou descrição.");
    }
    const db = getDb();
    const { data: product, error } = await db
      .from("products")
      .insert({
        name: analysis.name || "Produto",
        link: link ?? null,
        description: data.description ?? null,
        image_urls: data.imagePaths,
        page_extract: pageText || null,
        analysis: analysis as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const settings: ProjectSettings = { duration: 15, sceneCount: 3, style: "auto", tone: "Natural", destination: "flow" };
    let hook = null;
    if (data.hookId) {
      const { data: h } = await db.from("hooks").select("template, hook_categories(name)").eq("id", data.hookId).single();
      if (h) hook = { category: (h.hook_categories as { name: string } | null)?.name ?? "", text: h.template, template: h.template };
    }
    const { data: project, error: pErr } = await db
      .from("projects")
      .insert({
        product_id: product.id,
        title: analysis.name || "Novo criativo",
        auto_mode: data.autoMode,
        settings: settings as never,
        hook: hook as never,
        current_step: "analysis",
      })
      .select("id")
      .single();
    if (pErr) throw new Error(pErr.message);
    return { projectId: project.id };
  });

export const updateProductAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        productId: z.string().uuid(),
        analysis: z.object({
          name: z.string().trim().min(1).max(200),
          category: z.string().max(200),
          summary: z.string().max(2000),
          features: z.array(z.string().max(300)).max(40),
          benefits: z.array(z.string().max(300)).max(40),
          audience: z.string().max(500),
          confirmed: z.array(z.string().max(300)).max(40),
          unknown: z.array(z.string().max(300)).max(40),
          visual_identity: z.string().max(2000),
          sufficient: z.boolean(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await getDb()
      .from("products")
      .update({ analysis: data.analysis as never, name: data.analysis.name, updated_at: new Date().toISOString() })
      .eq("id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProductImages = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid(), paths: z.array(z.string()).max(4) }).parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: p } = await db.from("products").select("image_urls").eq("id", data.productId).single();
    const next = [...(p?.image_urls ?? []), ...data.paths].slice(0, 6);
    await db.from("products").update({ image_urls: next }).eq("id", data.productId);
    return { ok: true };
  });

/** Reanalisa o produto com todas as entradas atuais (após adicionar imagem/descrição). */
export const reanalyzeProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid(), description: z.string().max(5000).optional() }).parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: p, error } = await db.from("products").select("*").eq("id", data.productId).single();
    if (error || !p) throw new Error("Produto não encontrado.");
    const description = data.description ?? p.description ?? undefined;
    const { analysis } = await runAnalysis({ link: p.link ?? undefined, description, imagePaths: p.image_urls });
    await db
      .from("products")
      .update({ analysis: analysis as never, name: analysis.name, description: description ?? null, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    return { ok: true };
  });
