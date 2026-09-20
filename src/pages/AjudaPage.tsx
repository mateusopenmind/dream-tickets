import { useState } from "react";
import { ajudaVisiveis } from "@/lib/ajudaConteudo";
import { SecaoAjudaView } from "@/components/AjudaConteudo";
import { usePerfil, useMinhasTelas } from "@/hooks/usePerfil";
import { Card } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AjudaPage() {
  const { data: perfil } = usePerfil();
  const { data: minhasTelas } = useMinhasTelas();
  const isSuper = perfil?.papel === "super_admin";
  const secoes = ajudaVisiveis(minhasTelas, isSuper);
  const [ativa, setAtiva] = useState<string | null>(null);
  const secao = secoes.find((s) => s.chave === ativa) ?? secoes[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Ajuda</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Passo a passo de cada tela e as regras de preenchimento de cada campo. Você também encontra a ajuda de cada
        tela pelo ícone <span className="inline-flex items-center align-middle"><HelpCircle className="h-3.5 w-3.5" /></span> no topo dela.
      </p>

      {!secao ? (
        <Card className="p-5 text-sm text-muted-foreground">
          Nenhum conteúdo de ajuda disponível para as telas que você tem acesso.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
          {/* Índice */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {secoes.map((s) => (
              <button
                key={s.chave}
                onClick={() => setAtiva(s.chave)}
                className={cn(
                  "text-left text-sm rounded-md px-3 py-2 whitespace-nowrap transition-colors",
                  secao.chave === s.chave
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {s.titulo}
              </button>
            ))}
          </nav>

          {/* Conteúdo */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold mb-3">{secao.titulo}</h2>
            <SecaoAjudaView secao={secao} />
          </Card>
        </div>
      )}
    </div>
  );
}
