import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Plus, Search, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listHookLibrary, toggleHookFavorite, createHook } from "@/lib/hooks.functions";

export const Route = createFileRoute("/ganchos")({ component: HooksPage });

function HooksPage(){
 const q=useQuery({queryKey:["hooks-library"],queryFn:()=>listHookLibrary()}); const qc=useQueryClient();
 const fav=useServerFn(toggleHookFavorite); const create=useServerFn(createHook);
 const [search,setSearch]=useState(""); const [cat,setCat]=useState(""); const [onlyFav,setOnlyFav]=useState(false); const [newText,setNewText]=useState("");
 const list=useMemo(()=>{const term=search.toLowerCase();return (q.data?.hooks??[]).filter(h=>(!cat||h.category_id===cat)&&(!onlyFav||h.is_favorite)&&(!term||h.template.toLowerCase().includes(term)))},[q.data,search,cat,onlyFav]);
 const catName=(id:string)=>q.data?.categories.find(c=>c.id===id)?.name??"";
 async function favorite(id:string,value:boolean){try{await fav({data:{id,favorite:value}});await qc.invalidateQueries({queryKey:["hooks-library"]})}catch(e){toast.error(e instanceof Error?e.message:"Falha ao favoritar.")}}
 async function add(){if(!cat||!newText.trim())return;try{await create({data:{categoryId:cat,template:newText.trim()}});setNewText("");await qc.invalidateQueries({queryKey:["hooks-library"]});toast.success("Gancho criado.")}catch(e){toast.error(e instanceof Error?e.message:"Falha ao criar.")}}
 return <div className="space-y-6">
 <header><p className="text-sm text-muted-foreground">Biblioteca</p><h1 className="text-3xl font-extrabold">Ganchos</h1><p className="mt-1 text-muted-foreground">Pesquise, favorite e reutilize estruturas de gancho.</p></header>
 <div className="flex flex-wrap gap-2"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar gancho..."/></div><Button variant={onlyFav?"secondary":"outline"} onClick={()=>setOnlyFav(v=>!v)}><Heart className="h-4 w-4"/> Favoritos</Button><Button asChild><Link to="/"><Sparkles className="h-4 w-4"/> Usar em conteúdo</Link></Button></div>
 <div className="flex flex-wrap gap-2">{(q.data?.categories??[]).map(c=><Button key={c.id} size="sm" variant={cat===c.id?"default":"outline"} onClick={()=>setCat(cat===c.id?"":c.id)}>{c.name}</Button>)}</div>
 <section className="rounded-2xl border bg-card p-4"><div className="flex gap-2"><Input value={newText} onChange={e=>setNewText(e.target.value)} placeholder={cat?"Criar novo template de gancho...":"Selecione uma categoria"}/><Button onClick={add} disabled={!cat||!newText.trim()}><Plus className="h-4 w-4"/> Criar</Button></div></section>
 {q.isLoading?<Loader2 className="h-7 w-7 animate-spin"/>:<div className="grid gap-3 md:grid-cols-2">{list.map(h=><article key={h.id} className="rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{catName(h.category_id)}</p><p className="mt-1 font-medium">“{h.template}”</p></div><button aria-label="Favoritar" onClick={()=>favorite(h.id,!h.is_favorite)}><Star className={`h-5 w-5 ${h.is_favorite?"fill-primary text-primary":"text-muted-foreground"}`}/></button></div><p className="mt-3 text-xs text-muted-foreground">Usado {h.usage_count}x · {h.source==="user"?"Criado por você":"Biblioteca"}</p><div className="mt-3"><Button asChild size="sm" className="w-full"><Link to="/" search={{hook:h.id,hookText:h.template}}>Usar este gancho</Link></Button></div></article>)}</div>}
 </div>
}
