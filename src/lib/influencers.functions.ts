import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb, signPaths, uploadBase64 } from "./db.server";
import { aiImage, aiJSON } from "./ai/provider.server";
import { INFLUENCER_SYSTEM } from "./ai/prompts.server";

const Config = z.object({
  gender: z.string().max(40),
  age: z.string().max(40),
  style: z.string().max(60),
  niche: z.string().max(60),
  hair: z.string().max(200).default(""),
  look: z.string().max(300).default(""),
  clothes: z.string().max(300).default(""),
  accessories: z.string().max(200).default(""),
  traits: z.string().max(300).default(""),
});

export type InfluencerOption = { name: string; identity: string; description: string; visual_traits: string };

export const generateInfluencerOptions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Config.parse(d))
  .handler(async ({ data }) => {
    const out = await aiJSON<{ options: InfluencerOption[] }>({
      task: "influencer_options",
      system: INFLUENCER_SYSTEM,
      user: `Preferências:\nGênero: ${data.gender}\nFaixa etária: ${data.age}\nEstilo: ${data.style}\nNicho: ${data.niche}\nCabelo: ${data.hair || "livre"}\nAparência geral: ${data.look || "livre"}\nRoupas: ${data.clothes || "livre"}\nAcessórios: ${data.accessories || "livre"}\nCaracterísticas visuais: ${data.traits || "livre"}`,
      validate: (v) => (Array.isArray(v.options) && v.options.length && v.options.every((o) => o.name && o.visual_traits) ? null : "opções"),
    });
    return out.options.slice(0, 3);
  });

function portraitPrompt(traits: string, style: string) {
  return `Foto retrato fotorrealista, vertical, de uma pessoa fictícia criadora de conteúdo (estilo ${style}). Aparência exata: ${traits}. Enquadramento meio corpo, olhando para a câmera, luz natural suave, fundo neutro de casa, sem texto, sem marca-d'água. Esta imagem será referência de identidade.`;
}

export const saveInfluencer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        config: Config,
        option: z.object({ name: z.string().max(80), identity: z.string().max(400), description: z.string().max(1000), visual_traits: z.string().max(1500) }),
        generateImage: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const refs: string[] = [];
    let imageError: string | null = null;
    if (data.generateImage) {
      try {
        const img = await aiImage({ task: "influencer_portrait", prompt: portraitPrompt(data.option.visual_traits, data.config.style) });
        refs.push(await uploadBase64(img.base64, img.mime, "influencers"));
      } catch (e) {
        imageError = e instanceof Error ? e.message : "Falha ao gerar imagem.";
      }
    }
    const { config } = data;
    const { data: row, error } = await db
      .from("influencers")
      .insert({
        name: data.option.name,
        gender: config.gender,
        age_range: config.age,
        style: config.style,
        niche: config.niche,
        appearance: { hair: config.hair, look: config.look, clothes: config.clothes, accessories: config.accessories, traits: config.traits },
        identity: data.option.identity,
        description: data.option.description,
        visual_traits: data.option.visual_traits,
        reference_image_urls: refs,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, imageError };
  });

export const listInfluencers = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await getDb().from("influencers").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const signed = await signPaths(data.flatMap((i) => i.reference_image_urls));
  return data.map((i) => ({ ...i, image_signed: i.reference_image_urls.map((p) => signed[p] ?? p) }));
});

export const updateInfluencer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            name: z.string().trim().min(1).max(80),
            identity: z.string().max(400),
            description: z.string().max(1000),
            visual_traits: z.string().max(1500),
            style: z.string().max(60),
            niche: z.string().max(60),
          })
          .partial(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await getDb().from("influencers").update({ ...data.patch, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const regenerateInfluencerPortrait = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: inf } = await db.from("influencers").select("*").eq("id", data.id).single();
    if (!inf) throw new Error("Influencer não encontrado.");
    const img = await aiImage({ task: "influencer_portrait", prompt: portraitPrompt(inf.visual_traits ?? inf.description ?? "", inf.style ?? "UGC") });
    const path = await uploadBase64(img.base64, img.mime, "influencers");
    await db.from("influencers").update({ reference_image_urls: [path, ...inf.reference_image_urls].slice(0, 6) }).eq("id", inf.id);
    return { ok: true };
  });

export const addInfluencerReference = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), path: z.string().min(3) }).parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: inf } = await db.from("influencers").select("reference_image_urls").eq("id", data.id).single();
    await db.from("influencers").update({ reference_image_urls: [...(inf?.reference_image_urls ?? []), data.path].slice(0, 6) }).eq("id", data.id);
    return { ok: true };
  });

export const duplicateInfluencer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: inf } = await db.from("influencers").select("*").eq("id", data.id).single();
    if (!inf) throw new Error("Influencer não encontrado.");
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = inf;
    const { error } = await db.from("influencers").insert({ ...rest, name: `${inf.name} (cópia)` });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInfluencer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await getDb().from("influencers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
