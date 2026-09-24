import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CREATION_FORMATS, OBJECTIVES } from "@/lib/constants";
import { Chip, Section, Spin, useProjectActions, useRun, view, type PData } from "./shared";

export function ObjectiveStep({ d, onNext }: { d: PData; onNext: () => void }) {
  const { settings } = view(d);
  const { save } = useProjectActions(d.project.id);
  const { busy, run } = useRun();
  const [format, setFormat] = useState(settings.format ?? "full");
  const [objective, setObjective] = useState(settings.objective ?? "");

  return (
    <div className="space-y-5">
      <Section title="O que você quer criar?">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CREATION_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`rounded-2xl border p-4 text-left text-sm font-medium transition-colors ${format === f.id ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Objetivo do conteúdo" desc="A estratégia de geração muda conforme o objetivo.">
        <div className="flex flex-wrap gap-2">
          <Chip active={!objective} onClick={() => setObjective("")}>IA escolhe</Chip>
          {OBJECTIVES.map((o) => (
            <Chip key={o.id} active={objective === o.id} onClick={() => setObjective(o.id)}>{o.label}</Chip>
          ))}
        </div>
      </Section>
      <Button
        size="lg"
        className="w-full"
        disabled={!!busy}
        onClick={() =>
          run("s", async () => {
            await save({ settings: { ...settings, format, objective: objective || undefined }, current_step: "hook" });
            onNext();
          })
        }
      >
        <Spin on={!!busy}>Continuar para o gancho</Spin>
      </Button>
    </div>
  );
}
