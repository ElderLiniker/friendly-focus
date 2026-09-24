import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export function ProgressSteps({ steps, current, error }: { steps: string[]; current: number; error?: string | null }) {
  return (
    <div className="space-y-3 rounded-3xl border border-border bg-card p-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-3 text-sm">
          {i < current ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : i === current && !error ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground" />
          )}
          <span className={i <= current ? "text-foreground" : "text-muted-foreground"}>{s}</span>
        </div>
      ))}
      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
