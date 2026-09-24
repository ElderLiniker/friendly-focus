import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getProject, updateProject } from "@/lib/projects.functions";
import { generateScript, generateScenes, generateCaption, generateHashtags } from "@/lib/generate.functions";
import { AnalysisStep } from "@/components/project/analysis-step";
import { ObjectiveStep } from "@/components/project/objective-step";
import { HookStep } from "@/components/project/hook-step";
import { InfluencerStep } from "@/components/project/influencer-step";
import { ScriptStep } from "@/components/project/script-step";
import { VideoStep } from "@/components/project/video-step";
import { ResultStep } from "@/components/project/result-step";
import { STEPS, projectQuery, type StepId, type PData } from "@/components/project/shared";

export const Route = createFileRoute("/projeto/$id")({
  loader: ({ params }) => getProject({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.project?.title ? `${loaderData.project.title} — TikPrompt` : "Projeto — TikPrompt" }],
  }),
  component: ProjectPage,
});

function normalizeStep(value: string | null | undefined): StepId {
  return STEPS.some((s) => s.id === value) ? (value as StepId) : "analysis";
}

function ProjectPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const query = useQuery(projectQuery(id));
  const update = useServerFn(updateProject);
  const genScript = useServerFn(generateScript);
  const genScenes = useServerFn(generateScenes);
  const genCaption = useServerFn(generateCaption);
  const genHashtags = useServerFn(generateHashtags);

  if (query.isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Não foi possível carregar o projeto</h1>
        <p className="text-sm text-muted-foreground">{query.error.message}</p>
        <Button onClick={() => navigate({ to: "/" })}>Voltar ao início</Button>
      </div>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Projeto não encontrado</h1>
        <Button onClick={() => navigate({ to: "/" })}>Voltar ao início</Button>
      </div>
    );
  }

  const d = data as PData;
  const step = normalizeStep(d.project.current_step);
  const index = STEPS.findIndex((s) => s.id === step);

  const go = (next: StepId) => {
    update({ data: { id, patch: { current_step: next } } })
      .then(() => query.refetch())
      .catch((e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar a etapa."));
  };

  const automatic = async () => {
    try {
      toast.loading("Gerando criativo automático...", { id: "auto" });
      await update({
        data: {
          id,
          patch: {
            settings: {
              ...(d.project.settings ?? {}),
              format: "full",
              objective: undefined,
              duration: 10,
              sceneCount: 3,
              style: "auto",
              tone: "Natural",
              destination: "flow",
            },
            hook: null,
            influencer_id: null,
            current_step: "script",
          },
        },
      });
      await genScript({ data: { projectId: id } });
      await genScenes({ data: { projectId: id } });
      await genCaption({ data: { projectId: id } });
      await genHashtags({ data: { projectId: id } });
      await update({ data: { id, patch: { current_step: "result", status: "generated" } } });
      await query.refetch();
      toast.success("Criativo automático pronto.", { id: "auto" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A geração automática falhou.", { id: "auto" });
      await query.refetch();
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-4 w-4" /> Novo conteúdo
          </Button>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">{d.project.title}</h1>
          <p className="text-sm text-muted-foreground">{d.product?.name || "Produto"} · Projeto TikPrompt</p>
        </div>
      </div>

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {STEPS.map((s, i) => {
          const active = i === index;
          const done = i < index;
          return (
            <button
              key={s.id}
              type="button"
              disabled={i > index}
              onClick={() => i <= index && go(s.id)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${active ? "border-primary bg-primary/10" : done ? "border-border bg-secondary/50" : "border-border opacity-50"}`}
            >
              <span className="flex items-center gap-1.5 font-semibold">
                {done ? <Check className="h-3.5 w-3.5 text-primary" /> : <span>{i + 1}</span>}
                {s.label}
              </span>
            </button>
          );
        })}
      </nav>

      <main>
        {step === "analysis" && <AnalysisStep d={d} onNext={() => go("objective")} onAuto={automatic} />}
        {step === "objective" && <ObjectiveStep d={d} onNext={() => go("hook")} />}
        {step === "hook" && <HookStep d={d} onNext={() => go("influencer")} />}
        {step === "influencer" && <InfluencerStep d={d} onNext={() => go("script")} />}
        {step === "script" && <ScriptStep d={d} onNext={() => go("video")} />}
        {step === "video" && <VideoStep d={d} onDone={() => go("result")} />}
        {step === "result" && <ResultStep d={d} />}
      </main>
    </div>
  );
}
