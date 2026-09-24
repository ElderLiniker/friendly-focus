import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb, signPaths } from "./db.server";

const Id = z.object({ id: z.string().uuid() });

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await getDb()
    .from("projects")
    .select("id,title,status,current_step,created_at,updated_at,settings,hook,scenes,parent_project_id,products(name,image_urls,link)")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const paths = data.map((p) => (p.products as { image_urls: string[] } | null)?.image_urls?.[0]).filter(Boolean) as string[];
  const signed = await signPaths(paths);
  return data.map((p) => {
    const prod = p.products as { name: string | null; image_urls: string[]; link: string | null } | null;
    const first = prod?.image_urls?.[0];
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      step: p.current_step,
      created_at: p.created_at,
      updated_at: p.updated_at,
      productName: prod?.name ?? null,
      link: prod?.link ?? null,
      thumb: first ? (signed[first] ?? null) : null,
      hook: (p.hook as { text?: string } | null)?.text ?? null,
      sceneCount: Array.isArray(p.scenes) ? p.scenes.length : 0,
      isVariation: !!p.parent_project_id,
    };
  });
});

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: project, error } = await db.from("projects").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) return null;
    const [{ data: product }, { data: influencer }, { data: images }, { data: variations }] = await Promise.all([
      project.product_id ? db.from("products").select("*").eq("id", project.product_id).maybeSingle() : Promise.resolve({ data: null }),
      project.influencer_id ? db.from("influencers").select("*").eq("id", project.influencer_id).maybeSingle() : Promise.resolve({ data: null }),
      db.from("generated_images").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
      db.from("projects").select("id,title,hook,created_at").eq("parent_project_id", project.id).order("created_at"),
    ]);
    const paths = [
      ...(product?.image_urls ?? []),
      ...(influencer?.reference_image_urls ?? []),
      ...(images ?? []).map((i) => i.url),
    ];
    const signed = await signPaths(paths);
    return {
      project,
      product: product ? { ...product, image_signed: product.image_urls.map((p) => signed[p] ?? p) } : null,
      influencer: influencer ? { ...influencer, image_signed: influencer.reference_image_urls.map((p) => signed[p] ?? p) } : null,
      images: (images ?? []).map((i) => ({ ...i, signed: signed[i.url] ?? i.url })),
      variations: variations ?? [],
    };
  });

const Patch = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      title: z.string().max(200),
      current_step: z.string().max(40),
      status: z.string().max(40),
      settings: z.record(z.string(), z.unknown()),
      hook: z.object({ category: z.string(), text: z.string().max(400), template: z.string().optional() }).nullable(),
      script: z.object({ hook: z.string(), development: z.string(), demonstration: z.string(), benefit: z.string(), cta: z.string() }).nullable(),
      scenes: z.array(z.object({ index: z.number(), duration: z.number(), action: z.string(), narration: z.string(), prompt: z.string().max(4000) })),
      caption: z.string().max(2200).nullable(),
      cta: z.string().max(500).nullable(),
      hashtags: z.array(z.string().max(60)).max(5),
      influencer_id: z.string().uuid().nullable(),
    })
    .partial(),
});

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Patch.parse(d))
  .handler(async ({ data }) => {
    const { error } = await getDb()
      .from("projects")
      .update({ ...(data.patch as Record<string, never>), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function cloneProject(id: string, mode: "duplicate" | "reuse" | "version") {
  const db = getDb();
  const { data: p, error } = await db.from("projects").select("*").eq("id", id).single();
  if (error || !p) throw new Error("Projeto não encontrado.");
  const base = {
    product_id: p.product_id,
    influencer_id: p.influencer_id,
    settings: p.settings,
    auto_mode: false,
  };
  const row =
    mode === "duplicate"
      ? { ...base, title: `${p.title} (cópia)`, strategy: p.strategy, hook: p.hook, script: p.script, scenes: p.scenes, caption: p.caption, cta: p.cta, hashtags: p.hashtags, current_step: p.current_step, status: p.status }
      : mode === "version"
        ? { ...base, title: `${p.title} — nova versão`, parent_project_id: p.id, current_step: "objective" }
        : { ...base, title: p.title, current_step: "objective" };
  const { data: created, error: cErr } = await db.from("projects").insert(row).select("id").single();
  if (cErr) throw new Error(cErr.message);
  return { id: created.id };
}

export const duplicateProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(({ data }) => cloneProject(data.id, "duplicate"));

export const reuseProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(({ data }) => cloneProject(data.id, "reuse"));

export const newVersionProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(({ data }) => cloneProject(data.id, "version"));

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data }) => {
    const { error } = await getDb().from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
