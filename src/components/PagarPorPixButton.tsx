import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMinhasTelas } from "@/hooks/usePerfil";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { contar } from "@/lib/plural";

// Botao "Pagar por Pix" das telas de Pagamentos.
//
// Ele NAO paga. Monta o lote (pagamentos_montar_lote) e leva para a Conferencia Pix,
// onde o titular de cada chave e consultado no Banco Central e a aprovacao acontece.
// Quem nao tem a tela de Conferencia nao ve o botao — pagar sem conferir nao existe.

type Tipo = "facial" | "fornecedor" | "reembolso";

interface Props {
  tipo: Tipo;
  ids: string[];
  valorUnitario?: number;   // obrigatorio apenas para facial
  disabled?: boolean;
}

// Teto zero: todo pagamento Pix, de qualquer valor, exige o codigo do aprovador.
const TETO_PADRAO = 0;

export function PagarPorPixButton({ tipo, ids, valorUnitario, disabled }: Props) {
  const navigate = useNavigate();
  const { data: telas } = useMinhasTelas();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!telas?.has("conferencia_pix")) return null;

  const montar = async () => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("pagamentos_montar_lote", {
        p_tipo: tipo,
        p_ids: ids,
        p_valor_unitario: tipo === "facial" ? (valorUnitario ?? null) : null,
        p_teto: TETO_PADRAO,
      });
      if (error) throw error;
      // Ja dispara a consulta de titulares: quando a tela abrir, os nomes vindos do
      // Banco Central ja estao chegando. Se falhar, o botao "Consultar titulares"
      // da propria Conferencia resolve — por isso nao derruba a navegacao.
      try {
        await supabase.functions.invoke("pagamentos-pix", { body: { acao: "preparar", lote_id: data } });
      } catch { /* a Conferencia mostra o botao para consultar na mao */ }
      setConfirmando(false);
      navigate(`/conferencia-pix?lote=${data}`);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível montar o lote.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled || ids.length === 0}
        onClick={() => setConfirmando(true)}
      >
        <Zap className="h-4 w-4 mr-2" />Pagar por Pix ({ids.length})
      </Button>

      <Dialog open={confirmando} onOpenChange={(o) => { if (!enviando) setConfirmando(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar {contar(ids.length, "pagamento", "pagamentos")} para conferência?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Nada é pago agora. O sistema vai:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>montar o lote com a chave Pix que está no cadastro de cada um;</li>
              <li>perguntar ao Banco Central o nome do titular de cada chave;</li>
              <li>abrir a tela de Conferência Pix para você conferir e aprovar.</li>
            </ol>
            <p className="text-muted-foreground">
              Quem não tem chave Pix no cadastro entra como bloqueado e continua sendo pago
              do jeito de sempre.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={enviando}>Voltar</Button>
            <Button onClick={montar} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Montar lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
