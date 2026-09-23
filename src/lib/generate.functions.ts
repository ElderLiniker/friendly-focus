import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "./db.server";
import { aiJSON } from "./ai/provider.server";
import {
  CAPTION_SYSTEM,
  HASHTAGS_SYSTEM,
  HOOKS_SYSTEM,
  SCRIPT_SYSTEM,
  VARIATIONS_SYSTEM,
  productContext,
  scenesSystem,
} from "./ai/prompts.server";
import {
  MAX_PROMPT_CHARS,
  OBJECTIVES,
  CREATION_FORMATS,
  type Hook,
  type ProductAnalysis,
  type ProjectSettings,
  type Scene,
  type Script,
  type Strategy,
} from "./constants";

const PID = z.object({ projectId: z.string().uuid() });

async function loadCtx(projectId: string) {
  const db = getDb();
  const { data: project, error } = await db.from("projects").select("*").eq("id", projectId).single();
  if (error || !project) throw new Error("Projeto não encontrado.");
  const { data: product } = project.product_id
    ? await db.from("products").select("*").eq("id", project.product_id).single()
    : { data: null };
  const { data: influencer } = project.influencer_id
    ? await db.from("influencers").select("*").eq("id", project.influencer_id).single()
    : { data: null };
  const analysis = (product?.analysis ?? null) as ProductAnalysis | null;
  if (!analysis) throw new Error("O produto ainda não foi analisado.");
  const settings = (project.settings ?? {}) as ProjectSettings;
  return { db, project, product, influencer, analysis, settings };
}

type Ctx = Awaited<ReturnType<typeof loadCtx>>;

function label(list: readonly { id: string; label: string }[], id?: string) {
  return list.find((o) => o.id === id)?.label ?? "IA escolhe automaticamente";
}

function briefing(c: Ctx) {
  const s = c.settings;
  const inf = c.influencer;
  return `${productContext(c.analysis, { description: c.product?.description })}

CONFIGURAÇÕES:
Formato: ${label(CREATION_FORMATS, s.format)}
Objetivo: ${label(OBJECTIVES, s.objective)}
Duração total: ${s.duration ?? 15} segundos
Estilo: ${!s.style || s.style === "auto" ? "IA recomenda" : s.style}
Tom: ${s.tone ?? "Natural"}
${inf ? `INFLUENCER (manter identidade): ${inf.name} — ${inf.identity ?? ""}. Aparência fixa: ${inf.visual_traits ?? inf.description ?? ""}` : "Influencer: nenhum definido (pode ser mãos/POV ou pessoa genérica descrita de forma consistente)."}`;
}

const nonEmpty = (s: unknown) => typeof s === "string" && s.trim().length > 0;

// ---------- GANCHOS ----------
export const generateHooks = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    PID.extend({ category: z.string().max(60).optional(), template: z.string().max(400).optional(), count: z.number().min(1).max(8).default(5) }).parse(d),
  )
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const ask = data.template
      ? `Adapte este gancho ao produto, mantendo a estrutura: "${data.template}". Gere ${data.count} variações adaptadas.`
      : data.category
        ? `Gere ${data.count} ganchos da categoria "${data.category}".`
        : `Escolha as melhores categorias para este produto e objetivo e gere ${data.count} ganchos variados.`;
    const out = await aiJSON<{ hooks: Hook[] }>({
      task: "hooks",
      projectId: data.projectId,
      system: HOOKS_SYSTEM,
      user: `${briefing(c)}\n\n${ask}`,
      validate: (v) => (Array.isArray(v.hooks) && v.hooks.length && v.hooks.every((h) => nonEmpty(h.text)) ? null : "ganchos"),
    });
    return out.hooks.slice(0, data.count);
  });

// ---------- ESTRATÉGIA + ROTEIRO ----------
async function scriptFor(c: Ctx, extra = "") {
  const hook = c.project.hook as Hook | null;
  const out = await aiJSON<{ strategy: Strategy; hook: Hook; script: Script }>({
    task: "script",
    projectId: c.project.id,
    system: SCRIPT_SYSTEM,
    user: `${briefing(c)}\n\n${hook?.text ? `GANCHO ESCOLHIDO (use exatamente, ajustando só se necessário para o produto): "${hook.text}"` : "Gancho: escolha o melhor para o produto e objetivo."}\n${extra}`,
    validate: (v) =>
      v?.script && ["hook", "development", "demonstration", "benefit", "cta"].every((k) => nonEmpty((v.script as Record<string, unknown>)[k])) && nonEmpty(v.hook?.text)
        ? null
        : "roteiro",
  });
  return out;
}

export const generateScript = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PID.extend({ instructions: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const out = await scriptFor(c, data.instructions ? `Instruções extras: ${data.instructions}` : "");
    await c.db
      .from("projects")
      .update({ strategy: out.strategy as never, hook: out.hook as never, script: out.script as never, current_step: "script", updated_at: new Date().toISOString() })
      .eq("id", c.project.id);
    return out;
  });

// ---------- CENAS / PROMPTS DE VÍDEO ----------
function sceneDurations(total: number, n: number) {
  const base = Math.floor(total / n);
  const arr = Array.from({ length: n }, () => base);
  let rest = total - base * n;
  for (let i = 0; rest > 0; i++, rest--) arr[i % n]++;
  return arr;
}

async function enforceLimit(c: Ctx, scenes: Scene[], max: number | null): Promise<Scene[]> {
  if (!max) return scenes;
  const out: Scene[] = [];
  for (const s of scenes) {
    if (s.prompt.length <= max) {
      out.push(s);
      continue;
    }
    const r = await aiJSON<{ prompt: string }>({
      task: "shorten_scene",
      projectId: c.project.id,
      system: `Reescreva o prompt de vídeo abaixo em no máximo ${max - 40} caracteres, mantendo: personagem, roupa, produto, ambiente, ação, a fala entre aspas, e os padrões (9:16, realismo, narração PT-BR, música baixa, sem legendas, sem marca-d'água, sem interface). Não invente nada. Responda JSON {"prompt":string}.`,
      user: s.prompt,
      validate: (v) => (nonEmpty(v.prompt) ? null : "prompt"),
    });
    out.push({ ...s, prompt: r.prompt.length <= max ? r.prompt : r.prompt.slice(0, max) });
  }
  return out;
}

async function buildScenes(c: Ctx, onlyIndex?: number): Promise<Scene[]> {
  const script = c.project.script as Script | null;
  if (!script) throw new Error("Gere o roteiro antes das cenas.");
  const total = c.settings.duration ?? 15;
  const n = c.settings.sceneCount ?? 3;
  const durs = sceneDurations(total, n);
  const max = (c.settings.destination ?? "flow") === "flow" ? MAX_PROMPT_CHARS : null;
  const existing = (c.project.scenes ?? []) as Scene[];
  const ask =
    onlyIndex !== undefined
      ? `Regenere APENAS a cena ${onlyIndex} (duração ${durs[onlyIndex - 1]}s), mantendo continuidade com as outras cenas abaixo. Retorne scenes com 1 item.\nCENAS ATUAIS:\n${existing.map((s) => `Cena ${s.index}: ${s.prompt}`).join("\n")}`
      : `Divida o roteiro em ${n} cena(s) com durações exatas: ${durs.map((d, i) => `cena ${i + 1} = ${d}s`).join(", ")}.`;
  const out = await aiJSON<{ scenes: Scene[] }>({
    task: onlyIndex ? "regenerate_scene" : "scenes",
    projectId: c.project.id,
    system: scenesSystem(max),
    user: `${briefing(c)}\n\nROTEIRO:\nGancho: ${script.hook}\nDesenvolvimento: ${script.development}\nDemonstração: ${script.demonstration}\nBenefício: ${script.benefit}\nCTA: ${script.cta}\n\n${ask}`,
    validate: (v) => (Array.isArray(v.scenes) && v.scenes.length && v.scenes.every((s) => nonEmpty(s.prompt)) ? null : "cenas"),
  });
  let scenes = out.scenes.map((s, i) => ({
    index: onlyIndex ?? i + 1,
    duration: onlyIndex ? durs[onlyIndex - 1] : (durs[i] ?? s.duration),
    action: s.action ?? "",
    narration: s.narration ?? "",
    prompt: s.prompt.trim(),
  }));
  if (!onlyIndex && scenes.length !== n) {
    if (scenes.length > n) scenes = scenes.slice(0, n);
    else throw new Error(`A IA retornou ${scenes.length} de ${n} cenas. Tente novamente.`);
  }
  return enforceLimit(c, scenes, max);
}

export const generateScenes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PID.parse(d))
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const scenes = await buildScenes(c);
    await c.db.from("projects").update({ scenes: scenes as never, current_step: "result", status: "generated", updated_at: new Date().toISOString() }).eq("id", c.project.id);
    return scenes;
  });

export const regenerateScene = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PID.extend({ index: z.number().int().min(1).max(6) }).parse(d))
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const [scene] = await buildScenes(c, data.index);
    const scenes = ((c.project.scenes ?? []) as Scene[]).map((s) => (s.index === data.index ? scene : s));
    await c.db.from("projects").update({ scenes: scenes as never, updated_at: new Date().toISOString() }).eq("id", c.project.id);
    return scenes;
  });

// ---------- LEGENDA / HASHTAGS ----------
function contentSummary(c: Ctx) {
  const script = c.project.script as Script | null;
  const hook = c.project.hook as Hook | null;
  return `${productContext(c.analysis)}\nObjetivo: ${label(OBJECTIVES, c.settings.objective)}\nGancho: ${hook?.text ?? "-"}\nRoteiro: ${script ? Object.values(script).join(" | ") : "-"}`;
}

export const generateCaption = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PID.parse(d))
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const out = await aiJSON<{ caption: string; cta: string }>({
      task: "caption",
      projectId: c.project.id,
      system: CAPTION_SYSTEM,
      user: contentSummary(c),
      validate: (v) => (nonEmpty(v.caption) && nonEmpty(v.cta) ? null : "legenda"),
    });
    await c.db.from("projects").update({ caption: out.caption, cta: out.cta, updated_at: new Date().toISOString() }).eq("id", c.project.id);
    return out;
  });

export const generateHashtags = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PID.parse(d))
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const out = await aiJSON<{ hashtags: string[] }>({
      task: "hashtags",
      projectId: c.project.id,
      system: HASHTAGS_SYSTEM,
      user: contentSummary(c),
      validate: (v) => (Array.isArray(v.hashtags) && v.hashtags.length ? null : "hashtags"),
    });
    const tags = [...new Set(out.hashtags.map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, "")).filter((h) => h.length > 1))].slice(0, 5);
    await c.db.from("projects").update({ hashtags: tags, updated_at: new Date().toISOString() }).eq("id", c.project.id);
    return tags;
  });

// ---------- VARIAÇÕES ----------
export const generateVariations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PID.parse(d))
  .handler(async ({ data }) => {
    const c = await loadCtx(data.projectId);
    const script = c.project.script as Script | null;
    const out = await aiJSON<{ variations: { label: string; strategy: Strategy; hook: Hook; script: Script }[] }>({
      task: "variations",
      projectId: c.project.id,
      system: VARIATIONS_SYSTEM,
      user: `${briefing(c)}\n\nVersão atual (não repetir): gancho "${(c.project.hook as Hook | null)?.text ?? "-"}"; roteiro ${script ? Object.values(script).join(" | ") : "-"}`,
      validate: (v) => (Array.isArray(v.variations) && v.variations.length >= 3 && v.variations.every((x) => x.script && nonEmpty(x.hook?.text)) ? null : "variações"),
    });
    const rows = out.variations.slice(0, 3).map((v, i) => ({
      product_id: c.project.product_id,
      influencer_id: c.project.influencer_id,
      parent_project_id: c.project.id,
      title: `${c.project.title} — Versão ${String.fromCharCode(65 + i)} (${v.label})`,
      settings: { ...c.settings, style: v.strategy?.style ?? c.settings.style } as never,
      strategy: v.strategy as never,
      hook: v.hook as never,
      script: v.script as never,
      current_step: "script",
    }));
    const { data: created, error } = await c.db.from("projects").insert(rows).select("id,title,hook");
    if (error) throw new Error(error.message);
    return created;
  });
