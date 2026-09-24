import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateCaption, generateHashtags, generateScenes, generateScript } from "@/lib/generate.functions";
import { errMsg } from "@/lib/client-utils";

export const PIPELINE_STEPS = ["Analisando produto...", "Definindo estratégia...", "Gerando roteiro...", "Preparando cenas...", "Finalizando criativo..."];

/** Executa a geração em etapas mostrando progresso real. Para no primeiro erro. */
export function usePipeline(projectId: string) {
  const script = useServerFn(generateScript);
  const scenes = useServerFn(generateScenes);
  const caption = useServerFn(generateCaption);
  const hashtags = useServerFn(generateHashtags);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  async function start(withScript: boolean) {
    setError(null);
    try {
      setStep(withScript ? 1 : 3);
      if (withScript) {
        await script({ data: { projectId } });
        setStep(3);
      }
      await scenes({ data: { projectId } });
      setStep(4);
      await caption({ data: { projectId } });
      await hashtags({ data: { projectId } });
      setStep(5);
      return true;
    } catch (e) {
      setError(errMsg(e));
      return false;
    }
  }

  return { step, error, running: step >= 0 && step < 5 && !error, start, reset: () => { setStep(-1); setError(null); } };
}
