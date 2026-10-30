import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// "?" pequeno ao lado do rótulo de um campo, com a explicação em balão.
// O TooltipProvider já envolve o app inteiro (App.tsx), então é só usar.
export function DicaCampo({ texto }: { texto: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Ajuda deste campo"
          onClick={(e) => e.preventDefault()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {texto}
      </TooltipContent>
    </Tooltip>
  );
}
