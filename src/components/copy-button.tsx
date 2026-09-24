import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CopyButton({ text, label = "Copiar", size = "sm" }: { text: string; label?: string; size?: "sm" | "default" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {done ? "Copiado" : label}
    </Button>
  );
}
