import { SecaoAjuda } from "@/lib/ajudaConteudo";
import { CheckCircle2, ListChecks, Info } from "lucide-react";

// Renderiza uma seção de ajuda (passo a passo + regras). Reutilizado na página e no popup.
export function SecaoAjudaView({ secao }: { secao: SecaoAjuda }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{secao.resumo}</p>

      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <ListChecks className="h-4 w-4 text-primary" /> Passo a passo
        </h4>
        <ol className="space-y-1.5 text-sm list-decimal pl-5 marker:text-muted-foreground">
          {secao.passos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Regras dos campos
        </h4>
        <div className="rounded-lg border divide-y">
          {secao.regras.map((r, i) => (
            <div key={i} className="flex flex-col sm:flex-row sm:gap-3 px-3 py-2 text-sm">
              <span className="font-medium sm:w-48 shrink-0">{r.campo}</span>
              <span className="text-muted-foreground">{r.regra}</span>
            </div>
          ))}
        </div>
      </div>

      {secao.observacoes && secao.observacoes.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold mb-1.5">
            <Info className="h-4 w-4 text-primary" /> Observações
          </h4>
          <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
            {secao.observacoes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
