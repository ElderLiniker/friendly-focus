import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb, toDataUrl, uploadBase64 } from "./db.server";
import { aiImage } from "./ai/provider.server";
import { IMAGE_KINDS, type ProductAnalysis } from "./constants";

const SCENE_BY_KIND: Record<string, string> = {
  holding: "a pessoa segura o produto na mão, mostrando-o para a câmera, estilo selfie UGC",
  using: "a pessoa está usando o produto de forma natural, conforme seu uso real",
  scene: "o produto sozinho em um cenário bonito e coerente com seu uso",
  lifestyle: "cena lifestyle do dia a dia com o produto em destaque",
  ugc: "foto amadora realista estilo UGC, feita com celular, com o produto",
  ad: "foto de anúncio limpa e profissional, produto em destaque, espaço livre para texto",
  cover: "foto de capa vertical chamativa para vídeo de TikTok com o produto em destaque",
  demo: "demonstração do produto em uso mostrando como funciona",
};

export const generateProductImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        kind: z.enum(IMAGE_KINDS.map((k) => k.id) as [string, ...string[]]),
        influencerId: z.string().uuid().nullable().optional(),
        extra: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: project } = await db.from("projects").select("id,product_id,influencer_id").eq("id", data.projectId).single();
    if (!project?.product_id) throw new Error("Projeto sem produto.");
    const { data: product } = await db.from("products").select("*").eq("id", project.product_id).single();
    if (!product) throw new Error("Produto não encontrado.");
    const analysis = product.analysis as ProductAnalysis | null;
    const needsInf = IMAGE_KINDS.find((k) => k.id === data.kind)?.needsInfluencer;
    const infId = data.influencerId ?? project.influencer_id;
    const { data: inf } = infId ? await db.from("influencers").select("*").eq("id", infId).single() : { data: null };
    if (needsInf && !inf) throw new Error("Selecione um influencer salvo para este tipo de imagem.");

    const refs: { url: string }[] = [];
    for (const p of product.image_urls.slice(0, 3)) {
      const d = await toDataUrl(p);
      if (d) refs.push({ url: d });
    }
    const productRefCount = refs.length;
    if (inf?.reference_image_urls?.[0]) {
      const d = await toDataUrl(inf.reference_image_urls[0]);
      if (d) refs.push({ url: d });
    }
    if (productRefCount === 0 && !analysis?.visual_identity) {
      throw new Error("Para gerar imagens fiéis ao produto, adicione ao menos uma foto do produto.");
    }

    const prompt = [
      `Foto fotorrealista vertical 9:16 para TikTok Shop: ${SCENE_BY_KIND[data.kind]}.`,
      `PRODUTO: ${analysis?.name ?? product.name}. ${analysis?.visual_identity ?? ""}`,
      productRefCount
        ? `As primeiras ${productRefCount} imagem(ns) anexada(s) são o PRODUTO REAL: reproduza exatamente embalagem, formato, quantidade, logotipo, cores, acessórios e identidade visual. Não altere, não adicione nem remova nada do produto.`
        : "Reproduza o produto exatamente conforme a descrição, sem inventar detalhes.",
      inf
        ? `PESSOA: ${inf.name}. Aparência fixa: ${inf.visual_traits ?? inf.description}. ${inf.reference_image_urls?.[0] ? "A última imagem anexada é a referência de identidade desta pessoa: mantenha o mesmo rosto, cabelo e estilo." : ""}`
        : "",
      data.extra ? `Detalhes adicionais: ${data.extra}` : "",
      "Sem texto, sem legendas, sem marca-d'água, sem interface de aplicativo.",
    ]
      .filter(Boolean)
      .join("\n");

    const img = await aiImage({ task: `image_${data.kind}`, prompt, references: refs, projectId: project.id });
    const path = await uploadBase64(img.base64, img.mime, "generated");
    const { error } = await db.from("generated_images").insert({ project_id: project.id, influencer_id: inf?.id ?? null, kind: data.kind, prompt, url: path });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGeneratedImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await getDb().from("generated_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
