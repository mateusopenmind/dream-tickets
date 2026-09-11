import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpsertEmissaoTerceirizada, useClientes, useFornecedores, useProgramas, useOperacoes, useOrigens, useEmissores, buscarResumoRecebimentosAvulsos, useMoedasDoPrograma } from "@/hooks/useData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { NumericInput } from "@/components/ui/numeric-input";
import { CampoErro } from "@/components/ui/campo-erro";
import { vLocalizador, vCodigoLA, vMilhas, vNumPax, vDataVoo, dataVooMax } from "@/lib/validacoesEmissao";
import { reaisDiferemDosCobrados, temAlgumAjuste } from "@/lib/ajustesEmissao";
import { useRegras, MILHAS_MIN_PADRAO, MILHAS_MIN_FRACIONADO } from "@/lib/regrasPrograma";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Send, RefreshCw, Ban, Lock, CheckCircle2, Copy, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampoValorEmissao, camposCambioParaSalvar, valorEmReais, vCamposEmMoeda } from "@/components/CampoValorEmissao";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any;
}

const emptyForm = {
  data_emissao: new Date().toISOString().split("T")[0],
  hora: new Date().toTimeString().slice(0, 5),
  localizador: "",
  programa: "",
  nome_operacao: "",
  emissor: "",
  origem_venda: "",
  cliente_id: "",
  fornecedor_id: "",
  passageiros_qtd: "" as unknown as number,
  milhas_cobrado: 0,
  preco_milheiro: 0,
  taxas_cobrado: 0,
  bagagens_cobrado: 0,
  assentos_cobrado: 0,
  taxas_tipo: "reais",
  bagagens_tipo: "reais",
  assentos_tipo: "reais",
  outros_tipo: "reais",
  outros_cobrado: 0,
  outros_descricao: "",
  preco_total: 0,
  milhas_real: 0,
  custo_milheiro: 0,
  taxas_real: 0,
  bagagens_real: 0,
  assentos_real: 0,
  taxas_real_tipo: "reais",
  bagagens_real_tipo: "reais",
  assentos_real_tipo: "reais",
  outros_real_tipo: "reais",
  outros_real: 0,
  // Câmbio (só quando o tipo do campo é "moeda") — ver components/CampoValorEmissao.tsx
  taxas_moeda: null as string | null, taxas_valor_moeda: null as number | null, taxas_cotacao: null as number | null,
  bagagens_moeda: null as string | null, bagagens_valor_moeda: null as number | null, bagagens_cotacao: null as number | null,
  assentos_moeda: null as string | null, assentos_valor_moeda: null as number | null, assentos_cotacao: null as number | null,
  outros_moeda: null as string | null, outros_valor_moeda: null as number | null, outros_cotacao: null as number | null,
  taxas_real_moeda: null as string | null, taxas_real_valor_moeda: null as number | null, taxas_real_cotacao: null as number | null,
  bagagens_real_moeda: null as string | null, bagagens_real_valor_moeda: null as number | null, bagagens_real_cotacao: null as number | null,
  assentos_real_moeda: null as string | null, assentos_real_valor_moeda: null as number | null, assentos_real_cotacao: null as number | null,
  outros_real_moeda: null as string | null, outros_real_valor_moeda: null as number | null, outros_real_cotacao: null as number | null,
  compra_apos_bagagens: false, compra_apos_assentos: false,
  ajuste_cupom: "",
  ajuste_hack_upgrade: false,
  ajuste_retarifacao: false,
  ajuste_retarifacao_outro_programa: false,
  programa_real: "",
  ajuste_taxa_resgate: false,
  ajuste_desconto_promo: false,
  ajuste_campo_aberto: "",
  data_voo_ida: "",
  codigo_la: "",
  status_pix: "EM ABERTO",
  valor_recebido: 0,
  data_recebimento: "",
  obs_pix: "",
  observacao: "",
  nota: "",
  txid: "",
  reprocessar: false,
  cancelar: false,
};

export function EmissaoTerceirizadaFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertEmissaoTerceirizada();
  const qc = useQueryClient();
  const { data: clientes } = useClientes();
  const { data: fornecedores } = useFornecedores();
  const { data: programas } = useProgramas();
  const { data: operacoes } = useOperacoes();
  const { data: origens } = useOrigens();
  const { data: emissores } = useEmissores();
  // Depois de Cobrar/Reprocessar, a emissão recebe pix_txid/forma_cobranca do n8n, mas `editing`
  // é uma prop "congelada" (snapshot de quando o dialog abriu) — sem isso a tela ficava mostrando
  // "pronto para cobrança" mesmo com o Pix já gerado no banco. `dadosAtualizados` sobrescreve
  // `editing` com a linha buscada de novo do banco após uma ação bem-sucedida.
  const [dadosAtualizados, setDadosAtualizados] = useState<any>(null);
  const ed = dadosAtualizados ?? editing;
  const nomeCliente = (id: string) => { const c = (clientes ?? []).find((x: any) => x.id === id); return c ? `${c.codigo} - ${c.nome_fantasia}` : "—"; };
  const nomeFornecedor = (id: string) => { const f = (fornecedores ?? []).find((x: any) => x.id === id); return f ? (f.codigo ? `${f.codigo} - ${f.nome}` : f.nome) : "—"; };
  const fmtMoeda = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setDadosAtualizados(null);
    if (editing) {
      setForm({
        data_emissao: editing.data_emissao || "",
        hora: editing.hora || "",
        localizador: editing.localizador || "",
        programa: editing.programa || "",
        nome_operacao: editing.nome_operacao || "",
        emissor: editing.emissor || "",
        origem_venda: editing.origem_venda || "",
        cliente_id: editing.cliente_id || "",
        fornecedor_id: editing.fornecedor_id || "",
        passageiros_qtd: editing.passageiros_qtd ?? "",
        milhas_cobrado: editing.milhas_cobrado ?? 0,
        preco_milheiro: editing.preco_milheiro ?? 0,
        taxas_cobrado: editing.taxas_cobrado ?? 0,
        bagagens_cobrado: editing.bagagens_cobrado ?? 0,
        assentos_cobrado: editing.assentos_cobrado ?? 0,
        taxas_tipo: editing.taxas_tipo || "reais",
        bagagens_tipo: editing.bagagens_tipo || "reais",
        assentos_tipo: editing.assentos_tipo || "reais",
        outros_tipo: (editing as any).outros_tipo || "reais",
        outros_cobrado: editing.outros_cobrado ?? 0,
        outros_descricao: editing.outros_descricao ?? "",
        preco_total: editing.preco_total ?? 0,
        milhas_real: editing.milhas_real ?? 0,
        custo_milheiro: editing.custo_milheiro ?? 0,
        taxas_real: editing.taxas_real ?? 0,
        bagagens_real: editing.bagagens_real ?? 0,
        assentos_real: editing.assentos_real ?? 0,
        taxas_real_tipo: editing.taxas_real_tipo || "reais",
        bagagens_real_tipo: editing.bagagens_real_tipo || "reais",
        assentos_real_tipo: editing.assentos_real_tipo || "reais",
        outros_real_tipo: (editing as any).outros_real_tipo || "reais",
        outros_real: editing.outros_real ?? 0,
        // Câmbio (só quando o tipo do campo é "moeda") — ver components/CampoValorEmissao.tsx
        taxas_moeda: (editing as any).taxas_moeda ?? null,
        taxas_valor_moeda: (editing as any).taxas_valor_moeda ?? null,
        taxas_cotacao: (editing as any).taxas_cotacao ?? null,
        bagagens_moeda: (editing as any).bagagens_moeda ?? null,
        bagagens_valor_moeda: (editing as any).bagagens_valor_moeda ?? null,
        bagagens_cotacao: (editing as any).bagagens_cotacao ?? null,
        assentos_moeda: (editing as any).assentos_moeda ?? null,
        assentos_valor_moeda: (editing as any).assentos_valor_moeda ?? null,
        assentos_cotacao: (editing as any).assentos_cotacao ?? null,
        outros_moeda: (editing as any).outros_moeda ?? null,
        outros_valor_moeda: (editing as any).outros_valor_moeda ?? null,
        outros_cotacao: (editing as any).outros_cotacao ?? null,
        taxas_real_moeda: (editing as any).taxas_real_moeda ?? null,
        taxas_real_valor_moeda: (editing as any).taxas_real_valor_moeda ?? null,
        taxas_real_cotacao: (editing as any).taxas_real_cotacao ?? null,
        bagagens_real_moeda: (editing as any).bagagens_real_moeda ?? null,
        bagagens_real_valor_moeda: (editing as any).bagagens_real_valor_moeda ?? null,
        bagagens_real_cotacao: (editing as any).bagagens_real_cotacao ?? null,
        assentos_real_moeda: (editing as any).assentos_real_moeda ?? null,
        assentos_real_valor_moeda: (editing as any).assentos_real_valor_moeda ?? null,
        assentos_real_cotacao: (editing as any).assentos_real_cotacao ?? null,
        outros_real_moeda: (editing as any).outros_real_moeda ?? null,
        outros_real_valor_moeda: (editing as any).outros_real_valor_moeda ?? null,
        outros_real_cotacao: (editing as any).outros_real_cotacao ?? null,
        compra_apos_bagagens: (editing as any).compra_apos_bagagens ?? false,
        compra_apos_assentos: (editing as any).compra_apos_assentos ?? false,
        ajuste_cupom: editing.ajuste_cupom != null ? String(editing.ajuste_cupom) : "",
        ajuste_hack_upgrade: !!editing.ajuste_hack_upgrade,
        ajuste_retarifacao: !!editing.ajuste_retarifacao,
        ajuste_retarifacao_outro_programa: !!(editing as any).ajuste_retarifacao_outro_programa,
        programa_real: (editing as any).programa_real || "",
        ajuste_taxa_resgate: !!editing.ajuste_taxa_resgate,
        ajuste_desconto_promo: !!editing.ajuste_desconto_promo,
        ajuste_campo_aberto: editing.ajuste_campo_aberto ?? "",
        data_voo_ida: editing.data_voo_ida || "",
        codigo_la: editing.codigo_la || "",
        status_pix: editing.status_pix || "EM ABERTO",
        valor_recebido: editing.valor_recebido ?? 0,
        data_recebimento: editing.data_recebimento ? editing.data_recebimento.split("T")[0] : "",
        obs_pix: editing.obs_pix || "",
        observacao: editing.observacao || "",
        nota: editing.nota || "",
        txid: editing.txid || "",
        reprocessar: editing.reprocessar ?? false,
        cancelar: editing.cancelar ?? false,
      });
    } else {
      const agora = new Date();
      setForm({
        ...emptyForm,
        data_emissao: agora.toISOString().split("T")[0],
        hora: agora.toTimeString().slice(0, 5),
      });
    }
  }, [editing, open]);

  // Em milhas entram no total via preço do milheiro; em R$ e em moeda já estão em reais
  // (a conversão pelo câmbio acontece no próprio campo).
  const valorTaxas = valorEmReais(form, "taxas", "cobrado", form.preco_milheiro);
  const valorBagagens = valorEmReais(form, "bagagens", "cobrado", form.preco_milheiro);
  const valorAssentos = valorEmReais(form, "assentos", "cobrado", form.preco_milheiro);
  const valorOutros = valorEmReais(form, "outros", "cobrado", form.preco_milheiro);
  const precoTotal = useMemo(() => {
    const t = (form.milhas_cobrado * form.preco_milheiro / 1000) + valorTaxas + valorBagagens + valorAssentos + valorOutros;
    return Math.round(t * 100) / 100;
  }, [form.milhas_cobrado, form.preco_milheiro, valorTaxas, valorBagagens, valorAssentos, valorOutros]);

  const custoTaxas = valorEmReais(form, "taxas", "real", form.custo_milheiro);
  const custoBagagens = valorEmReais(form, "bagagens", "real", form.custo_milheiro);
  const custoAssentos = valorEmReais(form, "assentos", "real", form.custo_milheiro);
  const custoOutros = valorEmReais(form, "outros", "real", form.custo_milheiro);
  const custoTotal = useMemo(() => {
    const t = (form.milhas_real * form.custo_milheiro / 1000) + custoTaxas + custoBagagens + custoAssentos + custoOutros;
    return Math.round(t * 100) / 100;
  }, [form.milhas_real, form.custo_milheiro, custoTaxas, custoBagagens, custoAssentos, custoOutros]);

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  // Regras do programa do CABEÇALHO (o que o cliente pediu). É o que decide se a Retarifação
  // pode ser marcada — se dependesse do programa emitido, não haveria como marcar a primeira vez.
  const regraCabecalho = useRegras(form.programa);
  // Retarifação: registra em que programa a emissão realmente saiu. Aqui é só registro —
  // emissão terceirizada não consome milhas próprias, então não há baixa de estoque nem conta.
  const retarifacaoAtiva = reaisDiferemDosCobrados(form) && regraCabecalho("ajuste_retarifacao_outro_programa") && !!form.ajuste_retarifacao_outro_programa;
  // Com retarifação, quem manda nas regras e nas moedas é o programa onde a emissão realmente saiu.
  const programaEfetivo = retarifacaoAtiva && form.programa_real ? form.programa_real : form.programa;
  // Regras ligadas para o programa efetivo (Configurações > Programas > aba Regras).
  const regra = useRegras(programaEfetivo);
  // Piso da Qtde Milhas: 1.000 no padrão, 100 nos programas com a regra "Milhas abaixo de 1.000".
  const milhasMin = regra("milhas_fracionadas") ? MILHAS_MIN_FRACIONADO : MILHAS_MIN_PADRAO;
  // Só programas internacionais liberam Taxas/Bagagens/Assentos/Outros em moeda estrangeira.
  // Moedas que este programa aceita e se ele aceita reais
  // (Configurações > Programas > aba Moedas + regra "Aceita valores em reais").
  const { moedas: moedasPrograma, aceitaReais, carregando: carregandoMoedas } = useMoedasDoPrograma(programaEfetivo);
  const permiteMoeda = moedasPrograma.length > 0;

  function validar(): string | null {
    if (!form.data_emissao) return "Informe a Data de Emissão.";
    if (!form.hora) return "Informe a Hora.";
    if (!form.localizador) return "Informe o Localizador.";
    if (!form.programa) return "Selecione o Programa.";
    if (!form.nome_operacao) return "Selecione o Nome da Operação.";
    if (!form.emissor) return "Selecione o Emissor.";
    if (!form.origem_venda) return "Selecione a Origem.";
    if (!form.cliente_id) return "Selecione o Cliente.";
    if (!form.fornecedor_id) return "Selecione o Fornecedor.";
    if (!form.data_voo_ida) return "Informe a Data do Voo (Ida).";
    { const e = vDataVoo(form.data_voo_ida, form.data_emissao); if (e) return e; }
    if (!form.passageiros_qtd || form.passageiros_qtd < 1) return "Informe o Nº de Pax.";
    if (regra("codigo_la") && !form.codigo_la) return `Código LA é obrigatório para emissões ${programaEfetivo}.`;
    if (form.outros_cobrado > 0 && !(form.outros_descricao || "").trim()) return "Descreva o que é a cobrança em 'Outros'.";
    if ([form.milhas_cobrado, form.preco_milheiro, form.taxas_cobrado, form.bagagens_cobrado, form.assentos_cobrado, form.outros_cobrado].some((v) => v != null && (isNaN(v) || v < 0)))
      return "Os Valores Cobrados não podem ser negativos.";
    if ([form.milhas_real, form.taxas_real, form.bagagens_real, form.assentos_real, form.outros_real, form.custo_milheiro].some((v) => v == null || isNaN(v) || v < 0))
      return "Preencha os Valores Reais (Milhas, Custo Milheiro, Taxas, Bagagens, Assentos e Outros). Podem ser 0, mas não negativos.";
    // O banco tem CHECK no piso das milhas; sem barrar aqui, o emissor levava o erro cru do Postgres.
    { const e = vMilhas(form.milhas_cobrado, milhasMin); if (e) return `Qtde Milhas (Cobrado): ${e}`; }
    { const e = vMilhas(form.milhas_real, milhasMin); if (e) return `Qtde Milhas (Real): ${e}`; }
    if (reaisDiferemDosCobrados(form) && !temAlgumAjuste(form))
      return "Os Valores Reais diferem dos Cobrados — preencha ao menos um campo de Ajuste (Cupom, Hack Upgrade, Retarifação, Taxa de Resgate, Desconto Promocional ou Campo Aberto).";
    if (retarifacaoAtiva && !form.programa_real) return "Retarifação (Outro Programa) marcada — selecione o Programa Emitido.";
    { const e = vCamposEmMoeda(form, permiteMoeda); if (e) return e; }
    return null;
  }

  const [disparando, setDisparando] = useState<string | null>(null);
  const [confirmarCobranca, setConfirmarCobranca] = useState(false);
  const dispararN8n = async (acao: "cobrar" | "reprocessar" | "cancelar") => {
    if (!editing?.id) { toast.error("Salve a emissão antes de disparar a ação."); return; }
    if (acao === "cancelar") {
      let aviso = "";
      try {
        const resumo = await buscarResumoRecebimentosAvulsos("emissoes_terceirizadas", editing.id);
        if (resumo.total > 0) {
          aviso = `\n\n⚠️ Atenção: existe(m) ${resumo.total} parcela(s) de recebimento avulso lançada(s) para esta emissão` +
            (resumo.recebidos > 0 ? `, sendo ${resumo.recebidos} já recebida(s) (R$ ${resumo.valor_recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` : "") +
            `. Cancelar a emissão NÃO cancela/exclui esses recebimentos automaticamente.`;
        }
      } catch { /* se a checagem falhar, segue com a confirmação padrão */ }
      if (!confirm("Confirmar CANCELAMENTO desta emissão?" + aviso)) return;
    }
    setDisparando(acao);
    const processando = toast.loading("Em processamento...");
    try {
      const { data, error } = await supabase.functions.invoke("disparar-n8n", { body: { acao, emissao_id: editing.id, tabela: "emissoes_terceirizadas" } });
      toast.dismiss(processando);
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["emissoes_terceirizadas"] });
      if (data?.n8n === "pendente") toast.warning("O processamento de cobranças ainda não foi configurado. Avise o suporte.");
      else if (acao === "cancelar") { toast.success(`Emissão ${editing?.id_emissao || ""}: Pix cancelado. Você pode cobrar novamente, editar ou excluir.`, { duration: 8000 }); onOpenChange(false); }
      else {
        toast.success(`Ação '${acao}' concluída.`);
        // Busca a linha já atualizada (pix_txid/forma_cobranca gravados pelo n8n) pra refletir na hora,
        // sem depender do usuário fechar e reabrir o dialog.
        const { data: fresh } = await supabase.from("emissoes_terceirizadas")
          .select("*, clientes(codigo,nome_fantasia), fornecedores(codigo,nome)")
          .eq("id", editing.id).single();
        if (fresh) setDadosAtualizados(fresh);
      }
    } catch (e: any) { toast.dismiss(processando); toast.error(e.message); }
    finally { setDisparando(null); }
  };

  const handleSave = async () => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    const diff = reaisDiferemDosCobrados(form);
    // Campos gerenciados pelo sistema (cobrança/pagamento) NÃO são gravados pela edição manual.
    const { status_pix: _s, valor_recebido: _v, data_recebimento: _d, obs_pix: _o, txid: _t, reprocessar: _r, cancelar: _c, ...dadosForm } = form as any;
    try {
      await upsert.mutateAsync({
        ...dadosForm,
        preco_total: precoTotal,
        id: editing?.id,
        passageiros_qtd: Number(form.passageiros_qtd) || null,
        cliente_id: form.cliente_id || null,
        fornecedor_id: form.fornecedor_id || null,
        hora: form.hora || null,
        data_voo_ida: form.data_voo_ida || null,
        codigo_la: regra("codigo_la") ? (form.codigo_la || null) : null,
        outros_descricao: form.outros_cobrado > 0 ? (form.outros_descricao || null) : null,
        ajuste_cupom: diff && regra("ajuste_cupom") && form.ajuste_cupom ? (parseFloat(form.ajuste_cupom) || null) : null,
        ajuste_hack_upgrade: diff && regra("ajuste_hack_upgrade") ? !!form.ajuste_hack_upgrade : false,
        ajuste_retarifacao: diff && regra("ajuste_retarifacao") ? !!form.ajuste_retarifacao : false,
        // A Retarifação (Outro Programa) é liberada pelo programa do CABEÇALHO — as demais regras seguem o programa emitido.
        ajuste_retarifacao_outro_programa: diff && regraCabecalho("ajuste_retarifacao_outro_programa") ? !!form.ajuste_retarifacao_outro_programa : false,
        ajuste_taxa_resgate: diff && regra("ajuste_taxa_resgate") ? !!form.ajuste_taxa_resgate : false,
        ajuste_desconto_promo: diff && regra("ajuste_desconto_promo") ? !!form.ajuste_desconto_promo : false,
        ajuste_campo_aberto: diff && regra("ajuste_campo_aberto") ? ((form.ajuste_campo_aberto || "").trim() || null) : null,
        // Programa onde a emissão realmente saiu (registro; terceirizada não baixa estoque próprio).
        programa_real: retarifacaoAtiva ? (form.programa_real || null) : null,
        // Moeda/valor/cotação de cada campo — só grava em quem está em "moeda"
        ...camposCambioParaSalvar(form, permiteMoeda),
      });
      toast.success(editing ? "Emissão atualizada!" : "Emissão criada!");
      onOpenChange(false);
    } catch (err) {
      console.error("[EMISSAO TERCEIRIZADA] erro:", err); toast.error((err as any)?.message || (err as any)?.details || "Erro ao salvar emissão");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? "Editar" : "Nova"} Emissão Terceirizada
            {ed?.id_emissao && (
              <span className="text-sm font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {ed.id_emissao}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="geral" className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="pix">Cobrança</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pr-2 mt-4 min-h-0">
            <TabsContent value="geral" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Data Emissão *</Label><Input type="date" value={form.data_emissao} onChange={e => setField("data_emissao", e.target.value)} /></div>
                <div className="grid gap-2"><Label>Hora *</Label><Input type="time" value={form.hora} onChange={e => setField("hora", e.target.value)} /></div>
                <div className="grid gap-2"><Label>Localizador *</Label><Input value={form.localizador} onChange={e => setField("localizador", e.target.value.toUpperCase().slice(0, 13))} placeholder="ABC123" maxLength={13} className={vLocalizador(form.localizador) ? "border-destructive" : ""} /><CampoErro msg={vLocalizador(form.localizador)} /></div>
                <div className="grid gap-2"><Label>Programa *</Label><SearchSelect value={form.programa} onChange={v => setField("programa", v)} options={(programas ?? []).filter((p: any) => (p as any).usar_nas_emissoes !== false).map(p => ({ value: p.nome, label: p.nome }))} /></div>
                <div className="grid gap-2"><Label>Nome Operação *</Label><SearchSelect value={form.nome_operacao} onChange={v => setField("nome_operacao", v)} options={(operacoes ?? []).map(o => ({ value: o.nome, label: o.nome }))} /></div>
                <div className="grid gap-2"><Label>Data Voo Ida *</Label><Input type="date" max={dataVooMax()} value={form.data_voo_ida} onChange={e => setField("data_voo_ida", e.target.value)} className={vDataVoo(form.data_voo_ida, form.data_emissao) ? "border-destructive" : ""} /><CampoErro msg={vDataVoo(form.data_voo_ida, form.data_emissao)} /></div>
                <div className="grid gap-2"><Label>Emissor *</Label><SearchSelect value={form.emissor} onChange={v => setField("emissor", v)} options={(emissores ?? []).map(e => ({ value: e.nome, label: e.nome }))} /></div>
                <div className="grid gap-2"><Label>Fornecedor *</Label><SearchSelect value={form.fornecedor_id} onChange={v => setField("fornecedor_id", v)} options={[...(fornecedores ?? [])].filter((f: any) => f.ativo !== false).sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR")).map((f: any) => ({ value: f.id, label: f.codigo ? `${f.codigo} - ${f.nome}` : f.nome }))} /></div>
                <div className="grid gap-2"><Label>Cliente *</Label><SearchSelect value={form.cliente_id} onChange={v => setField("cliente_id", v)} options={[...(clientes ?? [])].sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })).map(c => ({ value: c.id, label: `${c.codigo} - ${c.nome_fantasia}` }))} /></div>
                <div className="grid gap-2"><Label>Nº Pax *</Label><Input type="number" min={1} value={form.passageiros_qtd ?? ""} onChange={e => setField("passageiros_qtd", e.target.value === "" ? "" : (parseInt(e.target.value) || 0))} className={vNumPax(form.passageiros_qtd) ? "border-destructive" : ""} /><CampoErro msg={vNumPax(form.passageiros_qtd)} /></div>
                <div className="grid gap-2"><Label>Origem *</Label><SearchSelect value={form.origem_venda} onChange={v => setField("origem_venda", v)} options={(origens ?? []).map(o => ({ value: o.nome, label: o.nome }))} /></div>
                {/* Latam: só Código LA (sem %Cashback / Pagar facial nesta tela) */}
                {regra("codigo_la") && (
                  <div className="grid gap-2"><Label>Código LA *</Label><Input value={form.codigo_la} onChange={e => setField("codigo_la", e.target.value.toUpperCase())} placeholder="LA123" className={vCodigoLA(form.codigo_la, true) ? "border-destructive" : ""} /><CampoErro msg={vCodigoLA(form.codigo_la, true)} /></div>
                )}

                {editing?.id && (
                  <div className="col-span-2 rounded-lg border bg-muted/40 p-3 mt-2">
                    {ed?.status_pix === "PAGO" ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle2 className="h-4 w-4" /> Cobrança paga{ed?.data_recebimento ? ` em ${new Date(ed.data_recebimento).toLocaleString("pt-BR")}` : ""}. Nenhuma ação disponível.
                      </p>
                    ) : ed?.forma_cobranca === "avulso" ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Wallet className="h-4 w-4" /> Cobrança controlada por Recebimento Avulso (Pix cancelado automaticamente). Acompanhe e edite as parcelas na tela "Recebimentos Avulsos".
                      </p>
                    ) : ed?.forma_cobranca && ed?.status_pix !== "CANCELADO" ? (
                      <>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-4 w-4" /> Cobrança já emitida{ed?.data_cobranca ? ` em ${new Date(ed.data_cobranca).toLocaleString("pt-BR")}` : ""}. Use "Reprocessar" para reenviar a mesma cobrança por WhatsApp (não gera uma nova).
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" disabled={disparando !== null} onClick={() => dispararN8n("reprocessar")}>
                            <RefreshCw className="h-4 w-4 mr-1" /> {disparando === "reprocessar" ? "..." : "Reprocessar"}
                          </Button>
                          <Button type="button" variant="outline" className="text-destructive" disabled={disparando !== null} onClick={() => dispararN8n("cancelar")}>
                            <Ban className="h-4 w-4 mr-1" /> {disparando === "cancelar" ? "..." : "Cancelar Cobrança"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          {ed?.status_pix === "CANCELADO" ? (validar() ? `Cobrança cancelada — para gerar uma nova, complete os campos: ${validar()}` : "Cobrança cancelada — gere uma nova quando quiser.") : `Ações${validar() ? ` — complete os campos antes de cobrar: ${validar()}` : " — emissão pronta para cobrança"}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="default" disabled={!!validar() || disparando !== null} onClick={() => setConfirmarCobranca(true)}>
                            <Send className="h-4 w-4 mr-1" /> {disparando === "cobrar" ? "Enviando..." : "Cobrar"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="financeiro" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <h3 className="col-span-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valores Cobrados</h3>
                <div className="grid gap-2"><Label>Qtde Milhas *</Label><NumericInput value={form.milhas_cobrado} onChange={n => setField("milhas_cobrado", n)} error={!!vMilhas(form.milhas_cobrado, milhasMin)} /><CampoErro msg={vMilhas(form.milhas_cobrado, milhasMin)} /></div>
                <div className="grid gap-2"><Label>Preço Milheiro *</Label><NumericInput value={form.preco_milheiro} onChange={n => setField("preco_milheiro", n)} decimal prefix="R$" /></div>
                <CampoValorEmissao label="Taxas" campo="taxas" bloco="cobrado" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Bagagens" campo="bagagens" bloco="cobrado" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Assentos" campo="assentos" bloco="cobrado" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Outros" campo="outros" bloco="cobrado" form={form} setForm={setForm} permiteMilhas={false} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <div className="grid gap-2"><Label>Preço Total</Label><Input type="text" readOnly disabled value={precoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} className="bg-muted font-semibold text-right" /></div>
                {form.outros_cobrado > 0 && (
                  <div className="grid gap-2 col-span-2">
                    <Label>Descrição de "Outros" *</Label>
                    <Input value={form.outros_descricao} onChange={e => setField("outros_descricao", e.target.value)} placeholder="Sobre o que é essa cobrança?" />
                  </div>
                )}

                <div className="col-span-2 flex items-center justify-between mt-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valores Reais (custo do Fornecedor)</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({
                    ...f,
                    milhas_real: f.milhas_cobrado,
                    taxas_real: f.taxas_cobrado, taxas_real_tipo: f.taxas_tipo,
                    taxas_real_moeda: f.taxas_moeda, taxas_real_valor_moeda: f.taxas_valor_moeda, taxas_real_cotacao: f.taxas_cotacao,
                    bagagens_real: f.bagagens_cobrado, bagagens_real_tipo: f.bagagens_tipo,
                    bagagens_real_moeda: f.bagagens_moeda, bagagens_real_valor_moeda: f.bagagens_valor_moeda, bagagens_real_cotacao: f.bagagens_cotacao,
                    assentos_real: f.assentos_cobrado, assentos_real_tipo: f.assentos_tipo,
                    assentos_real_moeda: f.assentos_moeda, assentos_real_valor_moeda: f.assentos_valor_moeda, assentos_real_cotacao: f.assentos_cotacao,
                    outros_real: f.outros_cobrado, outros_real_tipo: f.outros_tipo,
                    outros_real_moeda: f.outros_moeda, outros_real_valor_moeda: f.outros_valor_moeda, outros_real_cotacao: f.outros_cotacao,
                  }))}>
                    <Copy className="h-3.5 w-3.5 mr-1" />Copiar dos Cobrados
                  </Button>
                </div>
                <div className="grid gap-2"><Label>Qtde Milhas *</Label><NumericInput value={form.milhas_real} onChange={n => setField("milhas_real", n)} error={!!vMilhas(form.milhas_real, milhasMin)} /><CampoErro msg={vMilhas(form.milhas_real, milhasMin)} /></div>
                <div className="grid gap-2"><Label>Custo Milheiro *</Label><NumericInput value={form.custo_milheiro} onChange={n => setField("custo_milheiro", n)} decimal prefix="R$" /></div>
                <CampoValorEmissao label="Taxas *" campo="taxas" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Bagagens" campo="bagagens" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Assentos" campo="assentos" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.compra_apos_bagagens} onChange={e => setField("compra_apos_bagagens", e.target.checked)} />
                    <span>Bagagens: compra após emissão</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.compra_apos_assentos} onChange={e => setField("compra_apos_assentos", e.target.checked)} />
                    <span>Assentos: compra após emissão</span>
                  </label>
                </div>
                <CampoValorEmissao label="Outros *" campo="outros" bloco="real" form={form} setForm={setForm} permiteMilhas={false} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                {/* Custo Total no lugar do Cartão Utilizado */}
                <div className="grid gap-2"><Label>Custo Total</Label><Input type="text" readOnly disabled value={custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} className="bg-muted font-semibold text-right" /></div>

                {reaisDiferemDosCobrados(form) && (
                  <>
                    <div className="col-span-2 mt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ajustes (Reais ≠ Cobrados)</h3>
                      <p className="text-xs text-muted-foreground mt-1">Preencha ao menos um campo para justificar a diferença.</p>
                    </div>
                    {regra("ajuste_cupom") && (
                      <div className="grid gap-2"><Label>Cupom (%)</Label><NumericInput value={Number(form.ajuste_cupom) || 0} onChange={n => setField("ajuste_cupom", String(n))} decimal /></div>
                    )}
                    {regra("ajuste_hack_upgrade") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_hack_upgrade} onChange={e => setField("ajuste_hack_upgrade", e.target.checked)} /><span className="text-sm">Hack Upgrade</span></label>
                    )}
                    {/* Retarifação simples: só a marcação, sem campo nenhum. */}
                    {regra("ajuste_retarifacao") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao} onChange={e => setField("ajuste_retarifacao", e.target.checked)} /><span className="text-sm">Retarifação</span></label>
                    )}
                    {regraCabecalho("ajuste_retarifacao_outro_programa") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao_outro_programa} onChange={e => setForm(f => ({ ...f, ajuste_retarifacao_outro_programa: e.target.checked, programa_real: "" }))} /><span className="text-sm">Retarifação (Outro Programa)</span></label>
                    )}
                    {/* Retarifação marcada: em que programa a emissão realmente saiu (registro). */}
                    {retarifacaoAtiva && (
                      <div className="grid gap-2"><Label>Programa Emitido *</Label><SearchSelect value={form.programa_real} onChange={v => setField("programa_real", v)} options={(programas ?? []).filter((p: any) => p.nome !== form.programa).map((p: any) => ({ value: p.nome, label: p.nome }))} /></div>
                    )}
                    {regra("ajuste_taxa_resgate") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_taxa_resgate} onChange={e => setField("ajuste_taxa_resgate", e.target.checked)} /><span className="text-sm">Taxa de Resgate</span></label>
                    )}
                    {regra("ajuste_desconto_promo") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_desconto_promo} onChange={e => setField("ajuste_desconto_promo", e.target.checked)} /><span className="text-sm">Desconto Promocional</span></label>
                    )}
                    {regra("ajuste_campo_aberto") && (
                      <div className="grid gap-2 col-span-2"><Label>Campo Aberto</Label><Textarea value={form.ajuste_campo_aberto} onChange={e => setField("ajuste_campo_aberto", e.target.value)} rows={2} placeholder="Descreva o motivo da diferença..." /></div>
                    )}
                  </>
                )}

                <div className="grid gap-2 col-span-2 mt-4"><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setField("observacao", e.target.value)} rows={2} placeholder="Observações adicionais..." /></div>
              </div>
            </TabsContent>

            <TabsContent value="pix" className="mt-0">
              <div className="space-y-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <Lock className="h-3.5 w-3.5" /> Dados da cobrança — preenchidos automaticamente pelo sistema. Somente leitura.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Forma de Cobrança</Label><Input value={ed?.forma_cobranca === "pix" ? "Pix" : ed?.forma_cobranca === "avulso" ? "Recebimento Avulso" : "— (não cobrada)"} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Banco Emissor</Label><Input value={ed?.forma_cobranca === "avulso" ? ((ed as any)?.pix_banco || "—") : (ed as any)?.pix_banco === "sicredi" ? "Sicredi" : (ed as any)?.pix_banco === "c6" ? "C6 Bank" : "—"} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Status</Label><Input value={ed?.status_pix || form.status_pix || ""} readOnly disabled /></div>
                    {(ed as any)?.forma_paga && (
                      <div className="grid gap-2"><Label>Pago com</Label><Input value="Pix" readOnly disabled /></div>
                    )}
                    <div className="grid gap-2"><Label>Valor Recebido</Label><Input value={ed?.valor_recebido ? `R$ ${Number(ed.valor_recebido).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : ""} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Data Recebimento</Label><Input value={ed?.data_recebimento ? new Date(ed.data_recebimento).toLocaleDateString("pt-BR") : ""} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>ID Emissão</Label><Input value={ed?.id_emissao || (editing ? "" : "Gerado ao salvar")} readOnly disabled /></div>

                    {ed?.forma_cobranca === "pix" && (<>
                      <div className="grid gap-2"><Label>TXID (Pix)</Label><Input value={(ed as any)?.pix_txid || form.txid || ""} readOnly disabled /></div>
                      <div className="col-span-2 grid gap-2"><Label>Pix Copia e Cola</Label><Textarea value={(ed as any)?.pix_copia_cola || ""} readOnly disabled rows={2} className="font-mono text-xs" /></div>
                    </>)}

                    <div className="col-span-2 grid gap-2"><Label>Observação</Label><Textarea value={ed?.obs_pix || form.obs_pix || ""} readOnly disabled rows={2} /></div>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Pagamento ao Fornecedor — controlado na tela "Pagamento Fornecedores".</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Fornecedor</Label><Input value={nomeFornecedor(form.fornecedor_id)} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Situação</Label><Input value={(ed as any)?.fornecedor_pago ? "Pago" : "Pendente"} readOnly disabled /></div>
                    {(ed as any)?.fornecedor_pago && (<>
                      <div className="grid gap-2"><Label>Data do Pagamento</Label><Input value={(ed as any)?.data_pagamento_fornecedor || ""} readOnly disabled /></div>
                      <div className="grid gap-2"><Label>Banco de Saída</Label><Input value={(ed as any)?.banco_pagamento_fornecedor || ""} readOnly disabled /></div>
                    </>)}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="mt-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={confirmarCobranca} onOpenChange={setConfirmarCobranca}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar cobrança</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <p className="text-muted-foreground">Confira os dados antes de enviar a cobrança:</p>
            <div className="rounded-lg border divide-y">
              {[
                ["Localizador", form.localizador],
                ["Cliente", nomeCliente(form.cliente_id)],
                ["Fornecedor", nomeFornecedor(form.fornecedor_id)],
                ["Programa", form.programa],
                ["Qtde Milhas", (form.milhas_cobrado || 0).toLocaleString("pt-BR")],
                ["Preço Milheiro", fmtMoeda(form.preco_milheiro)],
                ["Taxas", form.taxas_tipo === "milhas" ? `${(form.taxas_cobrado || 0).toLocaleString("pt-BR")} milhas` : fmtMoeda(valorTaxas)],
                ["Bagagens", form.bagagens_tipo === "milhas" ? `${(form.bagagens_cobrado || 0).toLocaleString("pt-BR")} milhas` : fmtMoeda(valorBagagens)],
                ["Assentos", form.assentos_tipo === "milhas" ? `${(form.assentos_cobrado || 0).toLocaleString("pt-BR")} milhas` : fmtMoeda(valorAssentos)],
                ["Outros", fmtMoeda(valorOutros)],
                ["Valor Total", fmtMoeda(precoTotal)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between px-3 py-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-center font-medium pt-1">Tem certeza que deseja cobrar?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarCobranca(false)}>Voltar</Button>
            <Button disabled={disparando !== null} onClick={async () => { setConfirmarCobranca(false); await dispararN8n("cobrar"); }}>
              {disparando === "cobrar" ? "Enviando..." : "Confirmar e Cobrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Dialog>
  );
}
