import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "./db.server";

// Ganchos vêm do banco: novos ganchos/categorias podem ser adicionados sem alterar código
// (e, na fase 2, pelo painel administrativo).
export const listHookLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const [{ data: categories, error: e1 }, { data: hooks, error: e2 }] = await Promise.all([
    db.from("hook_categories").select("id,slug,name,sort_order").eq("is_active", true).order("sort_order"),
    db.from("hooks").select("id,category_id,template,is_favorite,source,usage_count").eq("is_active", true).order("created_at"),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  return { categories: categories ?? [], hooks: hooks ?? [] };
});

export const toggleHookFavorite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), favorite: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await getDb().from("hooks").update({ is_favorite: data.favorite }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createHook = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ categoryId: z.string().uuid(), template: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await getDb().from("hooks").insert({ category_id: data.categoryId, template: data.template, source: "user" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markHookUsed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = getDb();
    const { data: h } = await db.from("hooks").select("usage_count").eq("id", data.id).single();
    await db.from("hooks").update({ usage_count: (h?.usage_count ?? 0) + 1 }).eq("id", data.id);
    return { ok: true };
  });
