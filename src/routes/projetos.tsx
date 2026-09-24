import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, FolderKanban, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listProjects, duplicateProject, reuseProject, newVersionProject, deleteProject } from "@/lib/projects.functions";

export const Route = createFileRoute("/projetos")({ component: ProjectsPage });

function ProjectsPage() {
  const q = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const qc = useQueryClient();
  const nav = useNavigate();
  const duplicate = useServerFn(duplicateProject);
  const reuse = useServerFn(reuseProject);
  const version = useServerFn(newVersionProject);
  const remove = useServerFn(deleteProject);

  async function runDuplicate(id: string) {
    try {
      const r = await duplicate({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      nav({ to: "/projeto/$id", params: { id: r.id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível duplicar."); }
  }
  async function runReuse(id: string) {
    try {
      const r = await reuse({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      nav({ to: "/projeto/$id", params: { id: r.id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível reutilizar."); }
  }
  async function runVersion(id: string) {
    try {
      const r = await version({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      nav({ to: "/projeto/$id", params: { id: r.id } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível criar a nova versão."); }
  }
  async function runDelete(id: string) {
    if (!window.confirm("Excluir este projeto? Esta ação não pode ser desfeita.")) return;
    try {
      await remove({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto excluído.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível excluir."); }
  }

  if (q.isLoading) return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (q.isError) return <div className="space-y-4"><h1 className="text-3xl font-bold">Meus projetos</h1><p className="text-sm text-destructive">{q.error.message}</p></div>;
  const items = q.data ?? [];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-muted-foreground">Histórico</p><h1 className="text-3xl font-extrabold">Meus projetos</h1><p className="mt-1 text-muted-foreground">Continue, duplique e reutilize seus criativos.</p></div>
      <Button asChild><Link to="/"><Plus className="h-4 w-4" /> Novo conteúdo</Link></Button>
    </header>
    {items.length === 0 ? <div className="rounded-3xl border border-dashed p-12 text-center"><FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 font-semibold">Ainda não há projetos</h2><p className="mt-1 text-sm text-muted-foreground">Crie seu primeiro criativo para ele aparecer aqui.</p><Button asChild className="mt-5"><Link to="/">Começar</Link></Button></div> :
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((p) =>
        <article key={p.id} className="overflow-hidden rounded-2xl border bg-card">
          <Link to="/projeto/$id" params={{ id: p.id }} className="block">
            {p.thumb ? <img src={p.thumb} alt="" className="h-44 w-full object-cover" /> : <div className="grid h-44 place-items-center bg-secondary"><FolderKanban className="h-10 w-10 text-muted-foreground" /></div>}
          </Link>
          <div className="space-y-3 p-4">
            <div><h2 className="line-clamp-1 font-semibold">{p.title}</h2><p className="text-xs text-muted-foreground">{p.productName ?? "Produto"} · {new Date(p.updated_at).toLocaleString("pt-BR")}</p></div>
            {p.hook && <p className="line-clamp-2 text-sm text-muted-foreground">“{p.hook}”</p>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{p.status}</span><span>·</span><span>{p.sceneCount} cenas</span>{p.isVariation && <><span>·</span><span>variação</span></>}</div>
            <div className="flex gap-2">
              <Button asChild size="sm" className="flex-1"><Link to="/projeto/$id" params={{ id: p.id }}><ExternalLink className="h-3.5 w-3.5" /> Abrir</Link></Button>
              <Button size="sm" variant="outline" title="Reutilizar produto e configurações" onClick={() => runReuse(p.id)}>Reutilizar</Button>
              <Button size="sm" variant="outline" title="Nova versão" onClick={() => runVersion(p.id)}>Nova versão</Button>
              <Button size="sm" variant="outline" title="Duplicar" onClick={() => runDuplicate(p.id)}><Copy className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" title="Excluir" onClick={() => runDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </article>
      )}</div>}
  </div>;
}
