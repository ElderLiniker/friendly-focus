import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DESTINATIONS, DURATIONS, SCENE_COUNTS, VIDEO_STYLES } from "@/lib/constants";
import { Chip, Section, useProjectActions, useRun, view, type PData } from "./shared";
import { PIPELINE_STEPS, usePipeline } from "./pipeline";
import { ProgressSteps } from "./progress-steps";

export function VideoStep({ d, onDone }: { d: PData; onDone: () => void }) {
  const v = view(d);
  const { save, refresh } = useProjectActions(d.project.id);
  const { run } = useRun();
  const pipe = usePipeline(d.project.id);
  const [s, setS] = useState({ ...v.settings, sceneCount: v.settings.sceneCount ?? 3, duration: v.settings.duration ?? 10, destination: v.settings.destination ?? "flow" });

  const go = () =>
    run("g", async () => {
      await save({ settings: s });
      const ok = await pipe.start(false);
      await refresh();
      if (ok) onDone();
    });

  if (pipe.step >= 0) {
    return (
      <div className="space-y-4">
        <ProgressSteps steps={PIPELINE_STEPS} current={pipe.step} error={pipe.error} />
        {pipe.error && <Button onClick={() => { pipe.reset(); }}>Voltar e tentar novamente</Button>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Section title="Duração do vídeo">
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((n) => <Chip key={n} active={s.duration === n} onClick={() => setS({ ...s, duration: n })}>{n}s</Chip>)}
        </div>
        {s.duration !== v.settings.duration && v.script && (
          <p className="text-xs text-muted-foreground">O roteiro foi feito para {v.settings.duration}s. Para melhor encaixe, regenere o roteiro na etapa anterior.</p>
        )}
      </Section>
      <Section title="Número de cenas" desc="Cada cena vira um prompt individual.">
        <div className="flex flex-wrap gap-2">
          {SCENE_COUNTS.map((n) => <Chip key={n} active={s.sceneCount === n} onClick={() => setS({ ...s, sceneCount: n })}>{n}</Chip>)}
        </div>
        <p className="text-xs text-muted-foreground">≈ {Math.round((s.duration / s.sceneCount) * 10) / 10}s por cena</p>
      </Section>
      <Section title="Estilo do vídeo">
        <div className="flex flex-wrap gap-2">
          <Chip active={!s.style || s.style === "auto"} onClick={() => setS({ ...s, style: "auto" })}>IA recomenda</Chip>
          {VIDEO_STYLES.map((st) => <Chip key={st} active={s.style === st} onClick={() => setS({ ...s, style: st })}>{st}</Chip>)}
        </div>
      </Section>
      <Section title="Ferramenta de destino" desc="Padrão: vertical 9:16, alto realismo, narração PT-BR, música baixa, sem legendas, sem marca-d'água.">
        <div className="flex flex-wrap gap-2">
          {DESTINATIONS.map((x) => <Chip key={x.id} active={s.destination === x.id} onClick={() => setS({ ...s, destination: x.id })}>{x.label}</Chip>)}
        </div>
      </Section>
      <Button size="lg" className="h-14 w-full bg-brand text-base shadow-glow" onClick={go}>
        <Clapperboard className="h-5 w-5" /> Gerar criativo
      </Button>
    </div>
  );
}
