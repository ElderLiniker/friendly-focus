import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { UserRound, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listInfluencers } from "@/lib/influencers.functions";
import { Section, Spin, useProjectActions, useRun, type PData } from "./shared";

export function InfluencerStep({ d, onNext }: { d: PData; onNext: () => void }) {
  const { save } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const q = useQuery({ queryKey: ["influencers"], queryFn: () => listInfluencers() });
  const [sel, setSel] = useState<string | null>(d.project.influencer_id);

  return (
    <div className="space-y-5">
      <Section
        title="Influencer"
        desc="Use um influencer salvo para manter a mesma identidade em imagens e vídeos — ou siga sem influencer."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/influencers" search={{ novo: true, voltar: d.project.id }}>
              <UserPlus className="h-4 w-4" /> Criar influencer
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setSel(null)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${sel === null ? "border-primary bg-primary/10" : "border-border"}`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-secondary"><UserRound className="h-6 w-6 text-muted-foreground" /></span>
            <span className="text-sm font-medium">Sem influencer<br /><span className="font-normal text-muted-foreground">mãos / POV / pessoa genérica</span></span>
          </button>
          {q.data?.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setSel(i.id)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${sel === i.id ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {i.image_signed[0] ? (
                <img src={i.image_signed[0]} alt={i.name} className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-secondary"><UserRound className="h-6 w-6" /></span>
              )}
              <span className="text-sm">
                <span className="font-medium">{i.name}</span>
                <br />
                <span className="text-muted-foreground">{[i.style, i.niche].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          ))}
        </div>
        {q.isLoading && <p className="text-sm text-muted-foreground">Carregando influencers...</p>}
      </Section>
      <Button
        size="lg"
        className="w-full"
        disabled={!!busy}
        onClick={() => run("s", async () => { await save({ influencer_id: sel, current_step: "script" }); onNext(); })}
      >
        <Spin on={!!busy}>Continuar para o roteiro</Spin>
      </Button>
    </div>
  );
}
