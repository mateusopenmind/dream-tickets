import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpsertReembolso, useTaxasQueimaCpf, useCartoes, pesquisarEmissoesLocalizador, getEmissaoReembolso } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/ui/search-select";
import { NumericInput } from "@/components/ui/numeric-input";
import { Search, Plane, Clock, CalendarClock, AlertTriangle, Send, RefreshCw, Ban, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any; // registro de reembolso (edição) ou null (novo)
  asPage?: boolean; // true = renderiza como página cheia (rota /reembolsos/novo); false = popup
}

const TIPOS = [
  { value: "total", label: "Reembolso Total" },
  { value: "parcial", label: "Reembolso Parcial" },
  { value: "taxas", label: "Reembolso Taxas" },
];
const MOTIVOS = [
  { value: "mudanca_planos", label: "Mudança de planos cliente/passageiro(s)" },
  { value: "atestado_medico", label: "Atestado médico passageiro(s)" },
  { value: "alteracao_cia", label: "Alteração/cancelamento Cia. Aérea" },
  { value: "erro_emissao", label: "Erro na emissão" },
];

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const roundInt = (n: number) => Math.round(Number(n) || 0);
const fmtMoeda = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMilhas = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
// datas sempre no formato BR (DD/MM/AAAA)
const fmtDataBR = (s?: string | null) => {
  if (!s) return "—";
  const [y, m, d] = String(s).slice(0, 10).split("-");
  return (y && m && d) ? `${d}/${m}/${y}` : String(s);
};
const fmtHoraBR = (h?: string | null) => (h ? String(h).slice(0, 5) : "");

// valor em R$ de um campo que pode estar em "reais" ou "milhas"
function valorReais(qtd: number, tipo: string | null | undefined, milheiro: number) {
  return (tipo === "milhas") ? (Number(qtd) || 0) * (Number(milheiro) || 0) / 1000 : (Number(qtd) || 0);
}

const emptyForm = {
  tipo: "total",
  motivo: "",
  pax_qtd: 1,
  observacao: "",
  cli_milhas: 0,
  cli_preco_milheiro: 0,
  cli_taxas: 0,
  cli_bagagens: 0,
  cli_assentos: 0,
  cli_outros: 0,
  multa_programa: 0,
  multa_cartao_id: "",
  taxas_embarque_deduzidas: false,
  queima_cpf: 0,
  dt_milhas: 0,
  dt_custo_milheiro: 0,
  dt_taxas: 0,
  dt_bagagens: 0,
  dt_assentos: 0,
  dt_outros: 0,
};

export function ReembolsoFormDialog({ open = true, onOpenChange, editing, asPage = false }: Props) {
  const upsert = useUpsertReembolso();
  const qc = useQueryClient();
  const { data: taxasQueima } = useTaxasQueimaCpf();
  const { data: cartoes } = useCartoes();

  const modoEdicao = !!editing;

  const [busca, setBusca] = useState("");
  const [pesquisando, setPesquisando] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [em, setEm] = useState<any>(null); // emissão selecionada
  const [rb, setRb] = useState<any>(null); // reembolso atual (edição) — atualizado após ações de cobrança
  const [disparando, setDisparando] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const setField = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Reset ao abrir
  useEffect(() => {
    if (!open) return;
    setRb(editing ?? null);
    if (editing) {
      setForm({
        tipo: editing.tipo || "total",
        motivo: editing.motivo || "",
        pax_qtd: editing.pax_qtd ?? 1,
        observacao: editing.observacao || "",
        cli_milhas: editing.cli_milhas ?? 0,
        cli_preco_milheiro: editing.cli_preco_milheiro ?? 0,
        cli_taxas: editing.cli_taxas ?? 0,
        cli_bagagens: editing.cli_bagagens ?? 0,
        cli_assentos: editing.cli_assentos ?? 0,
        cli_outros: editing.cli_outros ?? 0,
        multa_programa: editing.multa_programa ?? 0,
        multa_cartao_id: editing.multa_cartao_id || "",
        taxas_embarque_deduzidas: !!editing.taxas_embarque_deduzidas,
        queima_cpf: editing.queima_cpf ?? 0,
        dt_milhas: editing.dt_milhas ?? 0,
        dt_custo_milheiro: editing.dt_custo_milheiro ?? 0,
        dt_taxas: editing.dt_taxas ?? 0,
        dt_bagagens: editing.dt_bagagens ?? 0,
        dt_assentos: editing.dt_assentos ?? 0,
        dt_outros: editing.dt_outros ?? 0,
      });
      setBusca(editing.localizador || "");
      setResultados([]);
      // carrega a emissão vinculada para exibição (via RPC — funciona mesmo sendo de outro usuário)
      (async () => {
        const tab = editing.tabela_origem === "emissoes_terceirizadas" ? "emissoes_terceirizadas" : "emissoes";
        try {
          const data = await getEmissaoReembolso(editing.emissao_id, tab);
          setEm(data ?? null);
        } catch {
          setEm(null);
        }
      })();
    } else {
      setForm({ ...emptyForm });
      setBusca("");
      setResultados([]);
      setEm(null);
    }
  }, [editing, open]);

  // Pesquisa ao vivo (typeahead) por Localizador — só no modo "novo" e enquanto nenhuma emissão
  // estiver selecionada. Debounce de 300ms.
  useEffect(() => {
    if (modoEdicao || em) { setResultados([]); return; }
    const t = busca.trim();
    if (t.length < 2) { setResultados([]); setPesquisando(false); return; }
    setPesquisando(true);
    const handle = setTimeout(async () => {
      try {
        const res = await pesquisarEmissoesLocalizador(t);
        setResultados(res);
      } catch {
        setResultados([]);
      } finally {
        setPesquisando(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [busca, em, modoEdicao]);

  const taxaQueimaValor = useMemo(() => {
    if (!em) return 0;
    const prog = (em.programa || "").trim().toLowerCase();
    const t = (taxasQueima ?? []).find((x) => (x.programa || "").trim().toLowerCase() === prog);
    return t ? Number(t.valor) || 0 : 0;
  }, [em, taxasQueima]);

  const totalPax = em?.passageiros_qtd || 1;
  const paxReembolso = form.tipo === "parcial" ? (Number(form.pax_qtd) || 0) : totalPax;
  const fator = totalPax > 0 ? paxReembolso / totalPax : 1; // proporcional (milhas e taxas)

  // Pré-preenche os campos do reembolso a partir da emissão (só no modo "novo").
  // Recalcula quando muda a emissão, o tipo ou o nº de pax (parcial).
  useEffect(() => {
    if (modoEdicao || !em) return;
    const milheiro = Number(em.preco_milheiro) || 0;
    setForm((f) => ({
      ...f,
      // Reembolso Cliente (dos Valores Cobrados)
      cli_milhas: roundInt((Number(em.milhas_cobrado) || 0) * fator),
      cli_preco_milheiro: milheiro,
      cli_taxas: round2(valorReais(em.taxas_cobrado, em.taxas_tipo, milheiro) * fator),
      cli_bagagens: round2(valorReais(em.bagagens_cobrado, em.bagagens_tipo, milheiro)),
      cli_assentos: round2(valorReais(em.assentos_cobrado, em.assentos_tipo, milheiro)),
      cli_outros: round2(em.outros_cobrado),
      multa_cartao_id: f.multa_cartao_id || "",
      queima_cpf: round2(taxaQueimaValor * paxReembolso),
      // Reembolso Dream Tickets (dos Valores Reais). Custo Milheiro: só existe em terceirizadas.
      dt_milhas: roundInt((Number(em.milhas_real) || 0) * fator),
      dt_custo_milheiro: round2(Number(em.custo_milheiro) || 0),
      dt_taxas: round2(valorReais(em.taxas_real, em.taxas_real_tipo, milheiro) * fator),
      dt_bagagens: round2(valorReais(em.bagagens_real, em.bagagens_real_tipo, milheiro)),
      dt_assentos: round2(valorReais(em.assentos_real, em.assentos_real_tipo, milheiro)),
      dt_outros: round2(em.outros_real),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [em, form.tipo, form.pax_qtd, taxaQueimaValor]);

  // Reembolso Taxas: zera Qtde Milhas (cliente e Dream) e Queima CPF.
  useEffect(() => {
    if (form.tipo === "taxas") {
      setForm((f) => ({ ...f, cli_milhas: 0, dt_milhas: 0, queima_cpf: 0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipo]);

  // 24h = momento do reembolso (agora) vs DATA/HORA da emissão. Em edição, usa o snapshot salvo.
  // Voo próximo = dias entre o voo e a emissão (≤ 7 dias).
  const { dentro24h, vooProximo, diasAteVoo } = useMemo(() => {
    if (!em?.data_emissao) return { dentro24h: null as boolean | null, vooProximo: null as boolean | null, diasAteVoo: null as number | null };
    let d24: boolean | null;
    if (modoEdicao) {
      d24 = editing?.dentro_24h ?? null;
    } else {
      const emsDT = new Date(`${em.data_emissao}T${(em.hora || "00:00").slice(0, 5)}:00`);
      const diffMs = Date.now() - emsDT.getTime();
      d24 = diffMs >= 0 ? diffMs <= 86400000 : true; // dentro de 24h após a emissão
    }
    let vp: boolean | null = null;
    let dv: number | null = null;
    if (em.data_voo_ida) {
      const voo = new Date(em.data_voo_ida + "T00:00:00");
      const emis = new Date(em.data_emissao + "T00:00:00");
      dv = Math.round((voo.getTime() - emis.getTime()) / 86400000);
      vp = dv <= 7;
    }
    return { dentro24h: d24, vooProximo: vp, diasAteVoo: dv };
  }, [em, modoEdicao, editing]);

  const selecionarEmissao = (m: any) => { setEm(m); setBusca(m.localizador || busca); setResultados([]); };

  // Totais calculados
  const valorMilhasCliente = (Number(form.cli_milhas) || 0) * (Number(form.cli_preco_milheiro) || 0) / 1000;
  // Total Reembolso Cliente = soma dos itens do lado cliente (milhas + taxas + bagagens + assentos + outros).
  // É o valor exatamente como está nos campos (podem ter sido ajustados na mão). Multa Programa e Queima CPF
  // NÃO são abatidos aqui — o desconto acontece só no RESUMO, para não descontar duas vezes.
  const brutoCliente = useMemo(() => round2(
    valorMilhasCliente + Number(form.cli_taxas) + Number(form.cli_bagagens) + Number(form.cli_assentos) + Number(form.cli_outros)
  ), [form.cli_milhas, form.cli_preco_milheiro, form.cli_taxas, form.cli_bagagens, form.cli_assentos, form.cli_outros]);

  const totalDream = useMemo(() => round2(
    (Number(form.dt_milhas) || 0) * (Number(form.dt_custo_milheiro) || 0) / 1000
    + Number(form.dt_taxas) + Number(form.dt_bagagens) + Number(form.dt_assentos) + Number(form.dt_outros)
  ), [form.dt_milhas, form.dt_custo_milheiro, form.dt_taxas, form.dt_bagagens, form.dt_assentos, form.dt_outros]);

  // Resumo / liquidação final: Valor pago emissão (0 quando cobrança em aberto) − Multa Programa − Queima CPF.
  // Proporcional aos pax reembolsados (mesmo fator de milhas/taxas/queima), para reembolso parcial não inflar o total.
  const valorPagoEmissao = useMemo(() => {
    if (!em) return 0;
    if (em.status_pix === "EM ABERTO") return 0;
    return round2((Number(em.valor_recebido) || 0) * fator);
  }, [em, fator]);
  // Cobrança EM ABERTO: regra antiga — nada foi recebido, então a base é o valor pago (zero).
  // Cobrança já PAGA: a base é EXATAMENTE o Reembolso Cliente informado, que pode ter sido
  // descontado na mão sem mudar o nº de pax — não se refaz conta nem se aplica fator de pax.
  const cobrancaEmAberto = em?.status_pix === "EM ABERTO";
  const baseResumo = cobrancaEmAberto ? valorPagoEmissao : brutoCliente;
  const totalLiquidacao = useMemo(
    () => round2(baseResumo - (Number(form.multa_programa) || 0) - (Number(form.queima_cpf) || 0)),
    [baseResumo, form.multa_programa, form.queima_cpf]
  );
  // >= 0 → temos que reembolsar o cliente (controle a pagar). < 0 → cliente nos deve (gerar Pix).
  const sentido: "reembolsar" | "cobrar" = totalLiquidacao >= 0 ? "reembolsar" : "cobrar";

  function validar(): string | null {
    if (!em) return "Busque e selecione uma emissão pelo Localizador.";
    if (!form.tipo) return "Selecione o Tipo de Reembolso.";
    if (!form.motivo) return "Selecione o Motivo do reembolso.";
    if (form.tipo === "parcial") {
      if (!form.pax_qtd || form.pax_qtd < 1) return "Informe o Nº de Pax do reembolso parcial.";
      if (form.pax_qtd > totalPax) return `O Nº de Pax não pode ser maior que ${totalPax} (quantidade da emissão).`;
    }
    return null;
  }

  const [salvando, setSalvando] = useState(false);
  const [confirmarSalvar, setConfirmarSalvar] = useState(false);

  // Valida e abre o resumo de confirmação (antes de gravar de fato).
  function handleSave() {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    setConfirmarSalvar(true);
  }

  // Executa a gravação após a confirmação do resumo.
  async function executarSalvar() {
    setConfirmarSalvar(false);
    setSalvando(true);
    const cobrar = sentido === "cobrar";
    const ehTaxas = form.tipo === "taxas"; // reembolso de taxas: sem milhas nem queima CPF
    try {
      const criado: any = await upsert.mutateAsync({
        id: editing?.id,
        emissao_id: em.id,
        tabela_origem: em._tabela || "emissoes",
        id_emissao: em.id_emissao ?? null,
        localizador: em.localizador ?? null,
        programa: em.programa ?? null,
        operacao: em.nome_operacao ?? null,
        conta: em.contas?.codigo ?? null,
        cartao: em.cartoes ? `${em.cartoes.codigo ?? ""} ${em.cartoes.nome ?? ""}`.trim() : null,
        total_milhas: (em.total_milhas ?? em.milhas_cobrado) ?? null,
        emissao_total: em.preco_total ?? null,
        cliente_id: em.cliente_id ?? null,
        tipo: form.tipo,
        motivo: form.motivo || null,
        pax_qtd: form.tipo === "parcial" ? Number(form.pax_qtd) : totalPax,
        dentro_24h: dentro24h,
        voo_proximo: vooProximo,
        observacao: form.observacao || null,
        cli_milhas: ehTaxas ? 0 : (Number(form.cli_milhas) || 0),
        cli_preco_milheiro: Number(form.cli_preco_milheiro) || 0,
        cli_taxas: Number(form.cli_taxas) || 0,
        cli_bagagens: Number(form.cli_bagagens) || 0,
        cli_assentos: Number(form.cli_assentos) || 0,
        cli_outros: Number(form.cli_outros) || 0,
        multa_programa: Number(form.multa_programa) || 0,
        multa_cartao_id: form.multa_cartao_id || null,
        taxas_embarque_deduzidas: !!form.taxas_embarque_deduzidas,
        queima_cpf: ehTaxas ? 0 : (Number(form.queima_cpf) || 0),
        total_cliente: brutoCliente,
        dt_milhas: ehTaxas ? 0 : (Number(form.dt_milhas) || 0),
        dt_custo_milheiro: Number(form.dt_custo_milheiro) || 0,
        dt_taxas: Number(form.dt_taxas) || 0,
        dt_bagagens: Number(form.dt_bagagens) || 0,
        dt_assentos: Number(form.dt_assentos) || 0,
        dt_outros: Number(form.dt_outros) || 0,
        total_dream: totalDream,
        // resumo / liquidação
        valor_pago_emissao: valorPagoEmissao,
        total_liquidacao: totalLiquidacao,
        sentido,
        a_pagar: sentido === "reembolsar",
        // valor a cobrar do cliente (usado pelo fluxo Pix quando sentido = 'cobrar')
        preco_total: cobrar ? Math.abs(totalLiquidacao) : null,
      });

      const idReembolso = (criado as any)?.id || editing?.id;

      // 1) Cancelar a cobrança Pix em aberto da emissão original — só na CRIAÇÃO.
      if (!editing && em.status_pix === "EM ABERTO" && em.pix_txid) {
        try {
          await supabase.functions.invoke("disparar-n8n", { body: { acao: "cancelar", emissao_id: em.id, tabela: em._tabela || "emissoes" } });
        } catch (e) { console.error("[REEMBOLSO] falha ao cancelar cobrança da emissão:", e); }
      }

      if (cobrar) {
        // Gerar Pix só na criação; na edição use os botões do painel (Reprocessar/Gerar).
        if (!editing && idReembolso) {
          try {
            const { data, error } = await supabase.functions.invoke("disparar-n8n", { body: { acao: "cobrar", forma: "pix", emissao_id: idReembolso, tabela: "reembolsos" } });
            if (error || (data as any)?.error) throw new Error((error as any)?.message || (data as any)?.error);
            if ((data as any)?.n8n === "pendente") toast.warning("Reembolso salvo, mas a geração do Pix ainda não está configurada. Avise o suporte.");
            else toast.success("Reembolso salvo e cobrança Pix gerada.");
          } catch (e: any) {
            console.error("[REEMBOLSO] falha ao gerar Pix:", e);
            toast.warning("Reembolso salvo, mas houve falha ao gerar o Pix. Tente reprocessar.");
          }
        } else {
          toast.success("Reembolso atualizado!");
        }
      } else {
        // a reembolsar (pagar ao cliente): envia o resumo por WhatsApp — na CRIAÇÃO e na EDIÇÃO.
        if (idReembolso) {
          try {
            await supabase.functions.invoke("disparar-n8n", { body: { acao: "reembolso_resumo", emissao_id: idReembolso, tabela: "reembolsos" } });
          } catch (e) { console.error("[REEMBOLSO] falha ao enviar resumo:", e); }
        }
        toast.success(editing
          ? "Reembolso atualizado! Resumo reenviado por WhatsApp."
          : "Reembolso registrado! Resumo enviado por WhatsApp. Entrou no controle de Pagamento de Reembolsos.");
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("[REEMBOLSO] erro:", err);
      toast.error(err?.message || err?.details || "Erro ao salvar reembolso.");
    } finally {
      setSalvando(false);
    }
  }

  // Reprocessar / cancelar / (re)gerar a cobrança Pix do reembolso — mesmo fluxo das emissões.
  async function dispararN8n(acao: "cobrar" | "reprocessar" | "cancelar") {
    if (!editing?.id) { toast.error("Salve o reembolso antes."); return; }
    if (acao === "cancelar" && !confirm("Cancelar a cobrança Pix deste reembolso?")) return;
    setDisparando(acao);
    const t = toast.loading("Processando...");
    try {
      const body: any = acao === "cobrar"
        ? { acao, forma: "pix", emissao_id: editing.id, tabela: "reembolsos" }
        : { acao, emissao_id: editing.id, tabela: "reembolsos" };
      const { data, error } = await supabase.functions.invoke("disparar-n8n", { body });
      toast.dismiss(t);
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.n8n === "pendente") toast.warning("O fluxo Pix de reembolsos ainda não está configurado no n8n. Avise o suporte.");
      else toast.success(`Ação '${acao}' concluída.`);
      // Recarrega o reembolso para refletir status/txid/copia-e-cola gravados pelo n8n.
      const { data: fresh } = await supabase
        .from("reembolsos")
        .select("*, clientes(codigo,nome_fantasia), cartoes(codigo,nome)")
        .eq("id", editing.id).maybeSingle();
      if (fresh) setRb(fresh);
      qc.invalidateQueries({ queryKey: ["reembolsos"] });
      qc.invalidateQueries({ queryKey: ["reembolsos-a-pagar"] });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Falha ao executar a ação.");
    } finally {
      setDisparando(null);
    }
  }

  // Reenviar por WhatsApp: se for cobrar (com Pix) reenvia a cobrança; se reembolsar (sem Pix) reenvia o resumo.
  async function reenviarWhatsapp() {
    if (!editing?.id) { toast.error("Salve o reembolso antes."); return; }
    const ehCobrar = (rb?.sentido ?? editing?.sentido ?? sentido) === "cobrar";
    setDisparando("reenviar");
    const t = toast.loading("Reenviando WhatsApp...");
    try {
      const acao = ehCobrar ? "reprocessar" : "reembolso_resumo";
      const { data, error } = await supabase.functions.invoke("disparar-n8n", { body: { acao, emissao_id: editing.id, tabela: "reembolsos" } });
      toast.dismiss(t);
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.n8n === "pendente") toast.warning("O fluxo de WhatsApp ainda não está configurado. Avise o suporte.");
      else toast.success("WhatsApp reenviado.");
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Falha ao reenviar o WhatsApp.");
    } finally {
      setDisparando(null);
    }
  }

  const Info = ({ label, value }: { label: string; value: any }) => (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );

  const emClienteLabel = em?.clientes ? `${em.clientes.codigo} - ${em.clientes.nome_fantasia}` : "—";
  const emContaLabel = em?.contas
    ? `${em.contas.codigo ?? ""} ${em.contas.nome ?? ""}`.trim()
    : em?.fornecedores
      ? `Forn: ${em.fornecedores.codigo ? em.fornecedores.codigo + " " : ""}${em.fornecedores.nome ?? ""}`.trim()
      : "—";
  const emEhTerceirizada = em?._tabela === "emissoes_terceirizadas";

  const idBadge = em?.id_emissao ? (
    <span className="text-sm font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">{em.id_emissao}</span>
  ) : null;

  const tipoResumoLabel = form.tipo === "total" ? "Total" : form.tipo === "parcial" ? `Parcial (${form.pax_qtd} pax)` : "Taxas";

  const corpo = (
    <>
      <div className={asPage ? "space-y-5" : "flex-1 overflow-y-auto pr-2 space-y-5"}>
          {/* Cobrança Pix do reembolso (edição) — reprocessar / cancelar / gerar */}
          {modoEdicao && rb && rb.sentido === "cobrar" && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Send className="h-3.5 w-3.5" /> Cobrança Pix do Reembolso
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                <Info label="ID Reembolso" value={rb.reembolso_id} />
                <Info label="Valor a cobrar" value={fmtMoeda(rb.preco_total)} />
                <Info label="Status" value={rb.status_pix || "— (não cobrada)"} />
                <Info label="Banco" value={rb.pix_banco === "sicredi" ? "Sicredi" : rb.pix_banco === "c6" ? "C6 Bank" : "—"} />
              </div>
              {rb.pix_copia_cola && (
                <div className="grid gap-1 mb-2">
                  <Label className="text-xs">Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Textarea readOnly value={rb.pix_copia_cola} rows={2} className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard?.writeText(rb.pix_copia_cola); toast.success("Copiado!"); }} title="Copiar">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              {rb.status_pix === "PAGO" ? (
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Cobrança paga{rb.data_recebimento ? ` em ${new Date(rb.data_recebimento).toLocaleString("pt-BR")}` : ""}. Nenhuma ação disponível.
                </p>
              ) : (rb.forma_cobranca && rb.status_pix !== "CANCELADO") ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={disparando !== null} onClick={() => dispararN8n("reprocessar")}>
                    <RefreshCw className="h-4 w-4 mr-1" />{disparando === "reprocessar" ? "..." : "Reprocessar (reenviar)"}
                  </Button>
                  <Button type="button" variant="outline" className="text-destructive" disabled={disparando !== null} onClick={() => dispararN8n("cancelar")}>
                    <Ban className="h-4 w-4 mr-1" />{disparando === "cancelar" ? "..." : "Cancelar cobrança"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{rb.status_pix === "CANCELADO" ? "Cobrança cancelada — gere uma nova quando quiser." : "Cobrança ainda não gerada."}</span>
                  <Button type="button" disabled={disparando !== null} onClick={() => dispararN8n("cobrar")}>
                    <Send className="h-4 w-4 mr-1" />{disparando === "cobrar" ? "Enviando..." : "Gerar cobrança Pix"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Busca ao vivo por Localizador (typeahead) */}
          {!modoEdicao && (
            <div className="grid gap-2">
              <Label>Localizador *</Label>
              {!em ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      value={busca}
                      onChange={(e) => setBusca(e.target.value.toUpperCase().slice(0, 13))}
                      placeholder="Digite o localizador da emissão"
                      maxLength={13}
                      className="pl-9"
                    />
                  </div>
                  {busca.trim().length >= 2 && (
                    <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                      {pesquisando && <p className="px-3 py-2 text-xs text-muted-foreground">Pesquisando…</p>}
                      {!pesquisando && resultados.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma emissão encontrada para “{busca.trim()}”.</p>
                      )}
                      {resultados.map((m) => (
                        <button key={m.id} type="button" onClick={() => selecionarEmissao(m)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent">
                          <span className="font-medium">
                            {m.localizador} <span className="font-mono text-xs text-muted-foreground">{m.id_emissao || "—"}</span>
                            {m._tabela === "emissoes_terceirizadas" && (
                              <span className="ml-1 rounded bg-amber-100 text-amber-800 px-1 py-0.5 text-[10px] align-middle">Terc.</span>
                            )}
                          </span>
                          <span className="text-muted-foreground text-xs text-right truncate">
                            {[m.programa, fmtDataBR(m.data_emissao), m.clientes ? m.clientes.nome_fantasia : null].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Digite ao menos 2 caracteres — as emissões aparecem conforme você digita.</p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-sm">
                    Emissão selecionada: <strong>{em.localizador}</strong>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{em.id_emissao || ""}</span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEm(null); setBusca(""); setResultados([]); }}>Trocar</Button>
                </div>
              )}
            </div>
          )}

          {em && (
            <>
              {/* Dados compactos da emissão */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Plane className="h-3.5 w-3.5" /> Dados da Emissão
                  {emEhTerceirizada && <span className="ml-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] normal-case">Terceirizada</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Info label="ID" value={em.id_emissao} />
                  <Info label="Data/Hora Emissão" value={`${fmtDataBR(em.data_emissao)}${em.hora ? " " + fmtHoraBR(em.hora) : ""}`} />
                  <Info label="Programa" value={em.programa} />
                  <Info label="Nome Operação" value={em.nome_operacao} />
                  <Info label="Data Voo Ida" value={fmtDataBR(em.data_voo_ida)} />
                  <Info label="Emissor" value={em.emissor} />
                  <Info label="Conta" value={emContaLabel} />
                  <Info label="Cliente" value={emClienteLabel} />
                  <Info label="Nº Pax" value={em.passageiros_qtd} />
                  <Info label="Cobrança" value={em.status_pix} />
                  <Info label="Preço Total" value={fmtMoeda(em.preco_total)} />
                  <Info label="Valor Recebido" value={fmtMoeda(em.valor_recebido)} />
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Valores Cobrados</span>
                    <p className="text-xs">Milhas: {fmtMilhas(em.milhas_cobrado)} · Milheiro: {fmtMoeda(em.preco_milheiro)}</p>
                    <p className="text-xs">Taxas: {em.taxas_tipo === "milhas" ? `${fmtMilhas(em.taxas_cobrado)} mi` : fmtMoeda(em.taxas_cobrado)} · Bag: {em.bagagens_tipo === "milhas" ? `${fmtMilhas(em.bagagens_cobrado)} mi` : fmtMoeda(em.bagagens_cobrado)}</p>
                    <p className="text-xs">Assentos: {em.assentos_tipo === "milhas" ? `${fmtMilhas(em.assentos_cobrado)} mi` : fmtMoeda(em.assentos_cobrado)} · Outros: {fmtMoeda(em.outros_cobrado)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Valores Reais</span>
                    <p className="text-xs">Milhas: {fmtMilhas(em.milhas_real)}</p>
                    <p className="text-xs">Taxas: {em.taxas_real_tipo === "milhas" ? `${fmtMilhas(em.taxas_real)} mi` : fmtMoeda(em.taxas_real)} · Bag: {em.bagagens_real_tipo === "milhas" ? `${fmtMilhas(em.bagagens_real)} mi` : fmtMoeda(em.bagagens_real)}</p>
                    <p className="text-xs">Assentos: {em.assentos_real_tipo === "milhas" ? `${fmtMilhas(em.assentos_real)} mi` : fmtMoeda(em.assentos_real)} · Outros: {fmtMoeda(em.outros_real)}</p>
                  </div>
                  <div>
                    {(Number(em.ajuste_cupom) > 0 || em.ajuste_hack_upgrade || em.ajuste_retarifacao || em.ajuste_taxa_resgate || em.ajuste_desconto_promo || (em.ajuste_campo_aberto && String(em.ajuste_campo_aberto).trim())) && (
                      <>
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Ajustes</span>
                        <p className="text-xs">{[
                          Number(em.ajuste_cupom) > 0 ? `Cupom: ${em.ajuste_cupom}%` : null,
                          em.ajuste_hack_upgrade ? "Hack Upgrade" : null,
                          em.ajuste_retarifacao ? "Retarifação" : null,
                          em.ajuste_taxa_resgate ? "Taxa de Resgate" : null,
                          em.ajuste_desconto_promo ? "Desc. Promo" : null,
                        ].filter(Boolean).join(" · ")}</p>
                        {em.ajuste_campo_aberto && <p className="text-xs">{em.ajuste_campo_aberto}</p>}
                      </>
                    )}
                    {em.observacao && <p className="text-xs text-muted-foreground mt-1">Obs: {em.observacao}</p>}
                  </div>
                </div>
              </div>

              {/* Sinalizadores de prazo */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${dentro24h ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  <Clock className="h-3.5 w-3.5" />
                  {dentro24h == null ? "Prazo indefinido" : dentro24h ? "Reembolso dentro das 24h da emissão" : "Reembolso fora das 24h da emissão"}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${vooProximo ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  {vooProximo == null ? "—" : vooProximo ? `Voo próximo (${diasAteVoo}d após emissão)` : `Voo com mais de 7 dias (${diasAteVoo}d)`}
                </span>
              </div>

              {/* Tipo e Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo de Reembolso *</Label>
                  <div className="inline-flex rounded-md border overflow-hidden text-sm">
                    {TIPOS.map((t) => (
                      <button key={t.value} type="button" onClick={() => setField("tipo", t.value)}
                        className={`px-3 py-2 transition-colors ${form.tipo === t.value ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {form.tipo === "parcial" && (
                    <div className="grid gap-1.5 mt-1">
                      <Label>Nº Pax (máx. {totalPax}) *</Label>
                      <Input type="number" min={1} max={totalPax} value={form.pax_qtd}
                        onChange={(e) => setField("pax_qtd", Math.min(totalPax, Math.max(0, parseInt(e.target.value) || 0)))} />
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Motivo *</Label>
                  <SearchSelect value={form.motivo} onChange={(v) => setField("motivo", v)} options={MOTIVOS} placeholder="Selecione o motivo" />
                </div>
              </div>

              {/* Reembolso Cliente */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reembolso Cliente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Qtde Milhas{form.tipo === "parcial" ? " (proporcional)" : ""}</Label><NumericInput value={form.cli_milhas} onChange={(n) => setField("cli_milhas", n)} placeholder="0" /></div>
                  <div className="grid gap-2"><Label>Preço Milheiro</Label><NumericInput value={form.cli_preco_milheiro} onChange={(n) => setField("cli_preco_milheiro", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Taxas{form.tipo === "parcial" ? " (proporcional)" : ""}</Label><NumericInput value={form.cli_taxas} onChange={(n) => setField("cli_taxas", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Bagagens</Label><NumericInput value={form.cli_bagagens} onChange={(n) => setField("cli_bagagens", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Assentos</Label><NumericInput value={form.cli_assentos} onChange={(n) => setField("cli_assentos", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Outros</Label><NumericInput value={form.cli_outros} onChange={(n) => setField("cli_outros", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Multa Programa</Label><NumericInput value={form.multa_programa} onChange={(n) => setField("multa_programa", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Cartão Utilizado (multa)</Label><SearchSelect value={form.multa_cartao_id} onChange={(v) => setField("multa_cartao_id", v)} options={[...(cartoes ?? [])].map((c) => ({ value: c.id, label: c.codigo || c.nome }))} placeholder="Selecione o cartão" /></div>
                  <div className="grid gap-2">
                    <Label>Queima CPF</Label>
                    <NumericInput value={form.queima_cpf} onChange={(n) => setField("queima_cpf", n)} decimal prefix="R$" placeholder="0,00" />
                    {taxaQueimaValor > 0 && (
                      <span className="text-[11px] text-muted-foreground">{fmtMoeda(taxaQueimaValor)} × {paxReembolso} pax = {fmtMoeda(taxaQueimaValor * paxReembolso)}</span>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none sm:col-span-2 lg:col-span-3">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={form.taxas_embarque_deduzidas} onChange={(e) => setField("taxas_embarque_deduzidas", e.target.checked)} />
                    <span>Taxas de embarque deduzidas</span>
                  </label>
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="text-sm">Total Reembolso Cliente: <strong>{fmtMoeda(brutoCliente)}</strong></span>
                </div>
              </div>

              {/* Reembolso Dream Tickets */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reembolso Dream Tickets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="grid gap-2"><Label>Qtde Milhas{form.tipo === "parcial" ? " (proporcional)" : ""}</Label><NumericInput value={form.dt_milhas} onChange={(n) => setField("dt_milhas", n)} placeholder="0" /></div>
                  <div className="grid gap-2"><Label>Custo Milheiro</Label><NumericInput value={form.dt_custo_milheiro} onChange={(n) => setField("dt_custo_milheiro", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Taxas{form.tipo === "parcial" ? " (proporcional)" : ""}</Label><NumericInput value={form.dt_taxas} onChange={(n) => setField("dt_taxas", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Bagagens</Label><NumericInput value={form.dt_bagagens} onChange={(n) => setField("dt_bagagens", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Assentos</Label><NumericInput value={form.dt_assentos} onChange={(n) => setField("dt_assentos", n)} decimal prefix="R$" placeholder="0,00" /></div>
                  <div className="grid gap-2"><Label>Outros</Label><NumericInput value={form.dt_outros} onChange={(n) => setField("dt_outros", n)} decimal prefix="R$" placeholder="0,00" /></div>
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="text-sm">Total Dream Tickets: <strong>{fmtMoeda(totalDream)}</strong></span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Observação</Label>
                <Textarea value={form.observacao} onChange={(e) => setField("observacao", e.target.value)} rows={2} placeholder="Observações do reembolso..." />
              </div>

              {/* Resumo / liquidação final */}
              <div className="rounded-lg border p-3 bg-muted/20">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resumo</h3>
                <div className="rounded-md border divide-y bg-background">
                  <div className="flex justify-between px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Reembolso Cliente</span>
                    <span className="font-medium">{fmtMoeda(baseResumo)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Multa Programa</span>
                    <span className="font-medium text-destructive">- {fmtMoeda(form.multa_programa)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-1.5 text-sm">
                    <span className="text-muted-foreground">Queima CPF</span>
                    <span className="font-medium text-destructive">- {fmtMoeda(form.queima_cpf)}</span>
                  </div>
                  <div className={`flex justify-between px-3 py-2 text-sm font-semibold ${sentido === "reembolsar" ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                    <span>{sentido === "reembolsar" ? "Total a Reembolsar (pagar ao cliente)" : "Total a Pagar (cobrar do cliente)"}</span>
                    <span>{fmtMoeda(Math.abs(totalLiquidacao))}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {sentido === "reembolsar"
                    ? "Ao salvar, entra no controle de Pagamento de Reembolsos para você quitar (valor, data e banco)."
                    : "Ao salvar, é gerada uma cobrança Pix (copia e cola) para o cliente pagar a diferença."}
                  {em && em.status_pix === "EM ABERTO" && em.pix_txid ? " A cobrança em aberto da emissão será cancelada." : ""}
                </p>
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" /> Este reembolso não altera os valores da emissão original (apenas cancela uma eventual cobrança Pix em aberto).
              </p>
            </>
          )}
        </div>

      <div className="mt-2 flex justify-end gap-2 border-t pt-3">
        {editing && (
          <Button type="button" variant="outline" className="mr-auto" onClick={reenviarWhatsapp} disabled={disparando !== null || salvando}>
            <RefreshCw className="h-4 w-4 mr-1" />{disparando === "reenviar" ? "Reenviando..." : "Reenviar WhatsApp"}
          </Button>
        )}
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button onClick={handleSave} disabled={!em || salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
      </div>

      {/* Resumo de confirmação antes de gravar */}
      <Dialog open={confirmarSalvar} onOpenChange={(o) => { if (!salvando) setConfirmarSalvar(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar reembolso</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium">↩️ Reembolso {tipoResumoLabel}</p>
            <div className="rounded-lg border divide-y">
              <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">🔖 Localizador</span><span className="font-medium">{em?.localizador || "—"}</span></div>
              <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">🏷️ Programa</span><span className="font-medium">{em?.programa || "—"}</span></div>
              <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">Reembolso Cliente</span><span className="font-medium">{fmtMoeda(baseResumo)}</span></div>
              <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">(-) Multa Programa</span><span className="font-medium text-destructive">{fmtMoeda(form.multa_programa)}</span></div>
              <div className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">(-) Queima CPF(s)</span><span className="font-medium text-destructive">{fmtMoeda(form.queima_cpf)}</span></div>
              <div className={`flex justify-between px-3 py-2 font-semibold ${sentido === "reembolsar" ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                <span>💰 TOTAL À {sentido === "reembolsar" ? "REEMBOLSAR" : "PAGAR"}</span>
                <span>{fmtMoeda(Math.abs(totalLiquidacao))}</span>
              </div>
            </div>
            {em?.status_pix === "EM ABERTO" && em?.pix_txid && (
              <p className="rounded-md border border-warning/40 bg-warning/10 text-warning px-3 py-2 text-xs">
                ⚠️ A cobrança Pix desta emissão está EM ABERTO (ainda não foi paga) e será cancelada ao salvar.
              </p>
            )}
            {sentido === "cobrar" && (
              <p className="text-xs text-muted-foreground">Ao confirmar, é gerada uma cobrança Pix (copia e cola) para o cliente pagar {fmtMoeda(Math.abs(totalLiquidacao))}.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarSalvar(false)} disabled={salvando}>Voltar</Button>
            <Button onClick={executarSalvar} disabled={salvando}>{salvando ? "Salvando..." : "Confirmar e salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // Modo página cheia (rota /reembolsos/novo) — mesmo formato das emissões.
  if (asPage) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Novo"} Reembolso</h1>
          {idBadge}
        </div>
        {corpo}
      </div>
    );
  }

  // Modo popup (edição a partir da lista).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? "Editar" : "Novo"} Reembolso {idBadge}
          </DialogTitle>
        </DialogHeader>
        {corpo}
      </DialogContent>
    </Dialog>
  );
}
