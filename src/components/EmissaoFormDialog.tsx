import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpsertEmissao, useClientes, useContas, useCartoes, useProgramas, useOperacoes, useEmissores, useOrigens, useContaProgramas, buscarResumoRecebimentosAvulsos, useMoedasDoPrograma } from "@/hooks/useData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { NumericInput } from "@/components/ui/numeric-input";
import { CampoErro } from "@/components/ui/campo-erro";
import { vLocalizador, vCodigoLA, vMilhas, vNumPax, vDataVoo, dataVooMax } from "@/lib/validacoesEmissao";
import { reaisDiferemDosCobrados, temAlgumAjuste, DICA_CONTA, DICA_CONTA_RETARIFADA } from "@/lib/ajustesEmissao";
import { DicaCampo } from "@/components/ui/dica-campo";
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
  conta_id: "",
  cartao_id: "",
  passageiros_qtd: "" as unknown as number,
  cpfs_otimizados: "",
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
  percentual_cb: 0,
  facial: null as boolean | null,
  status_pix: "EM ABERTO",
  valor_recebido: 0,
  data_recebimento: "",
  obs_pix: "",
  observacao: "",
  nota: "",
  forma_pagamento: "",
  txid: "",
  reprocessar: false,
  cancelar: false,
};

export function EmissaoFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertEmissao();
  const qc = useQueryClient();
  const { data: clientes } = useClientes();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: programas } = useProgramas();
  const { data: contaProgramas } = useContaProgramas();
  const { data: operacoes } = useOperacoes();
  const { data: emissores } = useEmissores();
  const { data: origens } = useOrigens();
  // Depois de Cobrar/Reprocessar, a emissão recebe pix_txid/forma_cobranca do n8n, mas `editing`
  // é uma prop "congelada" (snapshot de quando o dialog abriu) — sem isso a tela ficava mostrando
  // "pronto para cobrança" mesmo com o Pix já gerado no banco. `dadosAtualizados` sobrescreve
  // `editing` com a linha buscada de novo do banco após uma ação bem-sucedida.
  const [dadosAtualizados, setDadosAtualizados] = useState<any>(null);
  const ed = dadosAtualizados ?? editing;
  const nomeCliente = (id: string) => { const c = (clientes ?? []).find((x: any) => x.id === id); return c ? `${c.codigo} - ${c.nome_fantasia}` : "—"; };
  const nomeConta = (id: string) => { const c = (contas ?? []).find((x: any) => x.id === id); return c ? `${c.codigo} - ${c.nome}` : "—"; };
  const nomeCartao = (id: string) => { const c = (cartoes ?? []).find((x: any) => x.id === id); return c ? `${c.codigo} - ${c.nome}` : "—"; };
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
        conta_id: editing.conta_id || "",
        cartao_id: editing.cartao_id || "",
        passageiros_qtd: editing.passageiros_qtd ?? "",
        cpfs_otimizados: editing.cpfs_otimizados != null ? String(editing.cpfs_otimizados) : "",
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
        taxas_real: editing.taxas_real ?? 0,
        bagagens_real: editing.bagagens_real ?? 0,
        assentos_real: editing.assentos_real ?? 0,
        taxas_real_tipo: editing.taxas_real_tipo || "reais",
        bagagens_real_tipo: editing.bagagens_real_tipo || "reais",
        assentos_real_tipo: editing.assentos_real_tipo || "reais",
        outros_real_tipo: (editing as any).outros_real_tipo || "reais",
        outros_real: editing.outros_real ?? 0,
        // Câmbio (só quando o tipo do campo é "moeda")
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
        percentual_cb: editing.percentual_cb ?? 0,
        facial: !!editing.facial,
        status_pix: editing.status_pix || "EM ABERTO",
        valor_recebido: editing.valor_recebido ?? 0,
        data_recebimento: editing.data_recebimento ? editing.data_recebimento.split("T")[0] : "",
        obs_pix: editing.obs_pix || "",
        observacao: editing.observacao || "",
        nota: editing.nota || "",
        forma_pagamento: editing.forma_pagamento || "",
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

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const setNumField = (key: string, value: string) => setForm(f => ({ ...f, [key]: parseFloat(value) || 0 }));
  // Regras do programa do CABEÇALHO (o que o cliente pediu). É o que decide se a Retarifação
  // pode ser marcada — se dependesse do programa emitido, não haveria como marcar a primeira vez.
  const regraCabecalho = useRegras(form.programa);
  // Retarifação: a emissão saiu em OUTRO programa (companhia parceira) e, quase sempre, em outra conta.
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

  // Com retarifação, o par "Programa Emitido" + "Conta" do bloco de Ajustes substitui a Conta do
  // cabeçalho e é o que baixa o estoque.
  const estoqueDoPrograma =(nome: string) => (programas ?? []).find((p: any) => p.nome === nome)?.programa_estoque_id;
  const contasDoPrograma = (nome: string) => {
    const est = estoqueDoPrograma(nome);
    return est ? (contas ?? []).filter((c: any) => contaProgramas?.[c.id]?.has(est) ?? false) : [];
  };
  const optContas = (lista: any[]) => [...lista]
    .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
    .map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }));
  const setProgramaReal = (v: string) => setForm(f => {
    const ok = contasDoPrograma(v).some((c: any) => c.id === f.conta_id);
    return { ...f, programa_real: v, conta_id: ok ? f.conta_id : "" };
  });

  // Filtro bidirecional conta ↔ programa (programas da conta selecionada).
  // Com retarifação a conta gravada é a do programa emitido — não pode filtrar o Programa do cabeçalho.
  const progsDaConta = !retarifacaoAtiva && form.conta_id ? (contaProgramas?.[form.conta_id]) : undefined;
  const programasFiltrados = (programas ?? []).filter((p: any) => (p as any).usar_nas_emissoes !== false).filter((p: any) => !progsDaConta || ((p as any).programa_estoque_id && progsDaConta.has((p as any).programa_estoque_id)));
  const estoqueProgSelecionado = (programas ?? []).find((p: any) => p.nome === form.programa)?.programa_estoque_id;
  const contasFiltradas = (contas ?? []).filter((c: any) => !estoqueProgSelecionado || (contaProgramas?.[c.id]?.has(estoqueProgSelecionado) ?? false));

  function validar(): string | null {
    if (!form.data_emissao) return "Informe a Data de Emissão.";
    if (!form.hora) return "Informe a Hora.";
    if (!form.localizador) return "Informe o Localizador.";
    if (!form.programa) return "Selecione o Programa.";
    if (!form.nome_operacao) return "Selecione o Nome da Operação.";
    if (!form.emissor) return "Selecione o Emissor.";
    if (!form.origem_venda) return "Selecione a Origem.";
    if (!form.cliente_id) return "Selecione o Cliente.";
    if (!retarifacaoAtiva && !form.conta_id) return "Selecione a Conta.";
    if (!form.cartao_id) return "Selecione o Cartão Utilizado.";
    if (!form.data_voo_ida) return "Informe a Data do Voo (Ida).";
    { const e = vDataVoo(form.data_voo_ida, form.data_emissao); if (e) return e; }
    if (!form.passageiros_qtd || form.passageiros_qtd < 1) return "Informe o Nº de Pax.";
    // Código LA obrigatório quando a regra estiver ligada para o programa
    if (regra("codigo_la") && !form.codigo_la) return `Código LA é obrigatório para emissões ${programaEfetivo}.`;
    if (form.outros_cobrado > 0 && !(form.outros_descricao || "").trim()) return "Descreva o que é a cobrança em 'Outros'.";
    // Valores Cobrados: opcionais (0 por padrão), mas não podem ser negativos
    if ([form.milhas_cobrado, form.preco_milheiro, form.taxas_cobrado, form.bagagens_cobrado, form.assentos_cobrado, form.outros_cobrado].some((v) => v != null && (isNaN(v) || v < 0)))
      return "Os Valores Cobrados não podem ser negativos.";
    // Valores Reais são obrigatórios (aceitam 0, mas não podem ser negativos)
    if ([form.milhas_real, form.taxas_real, form.bagagens_real, form.assentos_real, form.outros_real].some((v) => v == null || isNaN(v) || v < 0))
      return "Preencha os Valores Reais (Milhas, Taxas, Bagagens, Assentos e Outros). Podem ser 0, mas não negativos.";
    // O banco tem CHECK no piso das milhas; sem barrar aqui, o emissor levava o erro cru do Postgres.
    { const e = vMilhas(form.milhas_cobrado, milhasMin); if (e) return `Qtde Milhas (Cobrado): ${e}`; }
    { const e = vMilhas(form.milhas_real, milhasMin); if (e) return `Qtde Milhas (Real): ${e}`; }
    // Reais ≠ Cobrados → ao menos um campo de ajuste preenchido
    if (reaisDiferemDosCobrados(form) && !temAlgumAjuste(form))
      return "Os Valores Reais diferem dos Cobrados — preencha ao menos um campo de Ajuste (Cupom, Hack Upgrade, Retarifação, Taxa de Resgate, Desconto Promocional ou Campo Aberto).";
    // Retarifação marcada: os dois campos são obrigatórios (é deles que sai a baixa de estoque).
    if (retarifacaoAtiva && !form.programa_real) return "Retarifação (Outro Programa) marcada — selecione o Programa Emitido.";
    if (retarifacaoAtiva && !form.conta_id) return "Retarifação (Outro Programa) marcada — selecione a Conta do Programa Emitido.";
    if (retarifacaoAtiva && !estoqueDoPrograma(form.programa_real))
      return `O programa "${form.programa_real}" não tem Programa de Estoque vinculado — a emissão não daria baixa. Ajuste em Configurações → Programas.`;
    if (regra("cpfs_otimizados") && form.cpfs_otimizados) {
      const n = parseInt(form.cpfs_otimizados);
      if (isNaN(n) || n < 1 || n > (form.passageiros_qtd || 0)) return `CPFs Otimizados deve ser entre 1 e ${form.passageiros_qtd || 0} (Nº de Pax).`;
    }
    if (!(precoTotal > 0)) return "O Valor Total deve ser maior que zero. Confira os Valores Cobrados.";
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
        const resumo = await buscarResumoRecebimentosAvulsos("emissoes", editing.id);
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
      const { data, error } = await supabase.functions.invoke("disparar-n8n", { body: { acao, emissao_id: editing.id } });
      toast.dismiss(processando);
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["emissoes"] });
      if (data?.n8n === "pendente") toast.warning("O processamento de cobranças ainda não foi configurado. Avise o suporte.");
      else if (acao === "cancelar") { toast.success(`Emissão ${editing?.id_emissao || ""}: Pix cancelado. Você pode cobrar novamente, editar ou excluir.`, { duration: 8000 }); onOpenChange(false); }
      else {
        toast.success(`Ação '${acao}' concluída.`);
        // Busca a linha já atualizada (pix_txid/forma_cobranca gravados pelo n8n) pra refletir na hora,
        // sem depender do usuário fechar e reabrir o dialog.
        const { data: fresh } = await supabase.from("emissoes")
          .select("*, clientes(codigo,nome_fantasia), contas(codigo,nome), cartoes(codigo,nome)")
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
    // Campos gerenciados pelo sistema (cobrança/pagamento) NÃO são gravados pela edição manual —
    // senão um "Salvar" após cancelar reverteria o status para EM ABERTO (Pix já morto no banco).
    const { status_pix: _s, valor_recebido: _v, data_recebimento: _d, obs_pix: _o, txid: _t, reprocessar: _r, cancelar: _c, ...dadosForm } = form as any;
    try {
      await upsert.mutateAsync({
        ...dadosForm,
        preco_total: precoTotal,
        id: editing?.id,
        passageiros_qtd: Number(form.passageiros_qtd) || null,
        cliente_id: form.cliente_id || null,
        conta_id: form.conta_id || null,
        cartao_id: form.cartao_id || null,
        hora: form.hora || null,
        data_voo_ida: form.data_voo_ida || null,
        // Campos liberados pelas regras do programa — não gravam em quem não usa
        codigo_la: regra("codigo_la") ? (form.codigo_la || null) : null,
        percentual_cb: regra("percentual_cb") ? (form.percentual_cb || null) : null,
        facial: regra("facial") && !!form.facial,
        outros_descricao: form.outros_cobrado > 0 ? (form.outros_descricao || null) : null,
        cpfs_otimizados: regra("cpfs_otimizados") && form.cpfs_otimizados ? (parseInt(form.cpfs_otimizados) || null) : null,
        // Ajustes: só gravam quando reais≠cobrados E a regra está ligada para o programa
        ajuste_cupom: diff && regra("ajuste_cupom") && form.ajuste_cupom ? (parseFloat(form.ajuste_cupom) || null) : null,
        ajuste_hack_upgrade: diff && regra("ajuste_hack_upgrade") ? !!form.ajuste_hack_upgrade : false,
        ajuste_retarifacao: diff && regra("ajuste_retarifacao") ? !!form.ajuste_retarifacao : false,
        // A Retarifação (Outro Programa) é liberada pelo programa do CABEÇALHO — as demais regras seguem o programa emitido.
        ajuste_retarifacao_outro_programa: diff && regraCabecalho("ajuste_retarifacao_outro_programa") ? !!form.ajuste_retarifacao_outro_programa : false,
        ajuste_taxa_resgate: diff && regra("ajuste_taxa_resgate") ? !!form.ajuste_taxa_resgate : false,
        ajuste_desconto_promo: diff && regra("ajuste_desconto_promo") ? !!form.ajuste_desconto_promo : false,
        ajuste_campo_aberto: diff && regra("ajuste_campo_aberto") ? ((form.ajuste_campo_aberto || "").trim() || null) : null,
        // Programa onde a emissão realmente saiu (só com retarifação). A Conta gravada já é a desse programa.
        programa_real: retarifacaoAtiva ? (form.programa_real || null) : null,
        // Moeda/valor/cotação de cada campo — só grava em quem está em "moeda"
        ...camposCambioParaSalvar(form, permiteMoeda),
      });
      toast.success(editing ? "Emissão atualizada!" : "Emissão criada!");
      onOpenChange(false);
    } catch (err) {
      console.error("[EMISSAO] erro:", err); toast.error((err as any)?.message || (err as any)?.details || "Erro ao salvar emissão");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? "Editar" : "Nova"} Emissão
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
            {/* Tab Geral - ordem identica a planilha */}
            <TabsContent value="geral" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Data Emissão *</Label><Input type="date" value={form.data_emissao} onChange={e => setField("data_emissao", e.target.value)} /></div>
                <div className="grid gap-2"><Label>Hora *</Label><Input type="time" value={form.hora} onChange={e => setField("hora", e.target.value)} /></div>
                <div className="grid gap-2"><Label>Localizador *</Label><Input value={form.localizador} onChange={e => setField("localizador", e.target.value.toUpperCase().slice(0, 13))} placeholder="ABC123" maxLength={13} className={vLocalizador(form.localizador) ? "border-destructive" : ""} /><CampoErro msg={vLocalizador(form.localizador)} /></div>
                <div className="grid gap-2"><Label>Programa *</Label><SearchSelect value={form.programa} onChange={v => setField("programa", v)} options={programasFiltrados.map(p => ({ value: p.nome, label: p.nome }))} /></div>
                <div className="grid gap-2"><Label>Nome Operação *</Label><SearchSelect value={form.nome_operacao} onChange={v => setField("nome_operacao", v)} options={(operacoes ?? []).map(o => ({ value: o.nome, label: o.nome }))} /></div>
                <div className="grid gap-2"><Label>Data Voo Ida *</Label><Input type="date" max={dataVooMax()} value={form.data_voo_ida} onChange={e => setField("data_voo_ida", e.target.value)} className={vDataVoo(form.data_voo_ida, form.data_emissao) ? "border-destructive" : ""} /><CampoErro msg={vDataVoo(form.data_voo_ida, form.data_emissao)} /></div>
                <div className="grid gap-2"><Label>Emissor *</Label><SearchSelect value={form.emissor} onChange={v => setField("emissor", v)} options={(emissores ?? []).map(e => ({ value: e.nome, label: e.nome }))} /></div>
                {retarifacaoAtiva
                  ? (
                    <div className="grid gap-2">
                      <div className="flex items-center gap-1.5"><Label>Conta</Label><DicaCampo texto={DICA_CONTA_RETARIFADA} /></div>
                      <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-xs text-muted-foreground">Definida na Retarifação (aba Valores)</div>
                    </div>
                  )
                  : (
                    <div className="grid gap-2">
                      <div className="flex items-center gap-1.5"><Label>Conta *</Label><DicaCampo texto={DICA_CONTA} /></div>
                      <SearchSelect value={form.conta_id} onChange={v => setField("conta_id", v)} options={optContas(contasFiltradas)} />
                    </div>
                  )}
                <div className="grid gap-2"><Label>Cliente *</Label><SearchSelect value={form.cliente_id} onChange={v => setField("cliente_id", v)} options={[...(clientes ?? [])].sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })).map(c => ({ value: c.id, label: `${c.codigo} - ${c.nome_fantasia}` }))} /></div>
                <div className="grid gap-2"><Label>Nº Pax *</Label><Input type="number" min={1} value={form.passageiros_qtd ?? ""} onChange={e => setField("passageiros_qtd", e.target.value === "" ? "" : (parseInt(e.target.value) || 0))} className={vNumPax(form.passageiros_qtd) ? "border-destructive" : ""} /><CampoErro msg={vNumPax(form.passageiros_qtd)} /></div>
                {regra("cpfs_otimizados") && (
                  <div className="grid gap-2"><Label>CPFs Otimizados</Label><Input type="number" min={1} max={form.passageiros_qtd || undefined} value={form.cpfs_otimizados} onChange={e => setField("cpfs_otimizados", e.target.value)} placeholder="Opcional" /></div>
                )}
                {/* Origem: campo geral (todos os programas) */}
                <div className="grid gap-2"><Label>Origem *</Label><SearchSelect value={form.origem_venda} onChange={v => setField("origem_venda", v)} options={(origens ?? []).map(o => ({ value: o.nome, label: o.nome }))} /></div>
                {/* Campos liberados por regra do programa: Código LA, % Cashback e Pagar facial */}
                {regra("codigo_la") && (
                  <div className="grid gap-2"><Label>Código LA *</Label><Input value={form.codigo_la} onChange={e => setField("codigo_la", e.target.value.toUpperCase())} placeholder="LA123" className={vCodigoLA(form.codigo_la, true) ? "border-destructive" : ""} /><CampoErro msg={vCodigoLA(form.codigo_la, true)} /></div>
                )}
                {regra("percentual_cb") && (
                  <div className="grid gap-2"><Label>% Cashback</Label><NumericInput value={form.percentual_cb} onChange={n => setField("percentual_cb", n)} decimal /></div>
                )}
                {regra("facial") && (
                  <div className="grid gap-2">
                    <Label>Pagar facial?</Label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setField("facial", true)} className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${form.facial === true ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>Sim</button>
                      <button type="button" onClick={() => setField("facial", false)} className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${form.facial === false ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>Não</button>
                    </div>
                  </div>
                )}

                {/* Acoes (disparam o n8n) conforme o estado da cobranca */}
                {editing?.id && (
                  <div className="col-span-2 rounded-lg border bg-muted/40 p-3 mt-2">
                    {ed?.status_pix === "PAGO" ? (
                      /* PAGA → nenhum botão, só aviso */
                      <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle2 className="h-4 w-4" /> Cobrança paga{ed?.data_recebimento ? ` em ${new Date(ed.data_recebimento).toLocaleString("pt-BR")}` : ""}. Nenhuma ação disponível.
                      </p>
                    ) : ed?.forma_cobranca === "avulso" ? (
                      /* Controlada por Recebimento Avulso → sem ações de cobrança automática aqui */
                      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <Wallet className="h-4 w-4" /> Cobrança controlada por Recebimento Avulso (Pix cancelado automaticamente). Acompanhe e edite as parcelas na tela "Recebimentos Avulsos".
                      </p>
                    ) : ed?.forma_cobranca && ed?.status_pix !== "CANCELADO" ? (
                      /* Cobrada e não paga → Reprocessar + Cancelar */
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
                      /* Não cobrada (ou cancelada) → só Cobrar */
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

            {/* Tab Financeiro - ordem identica a planilha (K -> Y) */}
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
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valores Reais</h3>
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
                <CampoValorEmissao label="Taxas *" campo="taxas" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Bagagens" campo="bagagens" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                <CampoValorEmissao label="Assentos" campo="assentos" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
                {/* Os checkboxes ficam alinhados sob Bagagens e Assentos — por isso Outros vem depois. */}
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
                <div className="grid gap-2"><Label>Cartão Utilizado *</Label><SearchSelect value={form.cartao_id} onChange={v => { const cart = (cartoes ?? []).find(c => c.id === v); setForm(f => ({ ...f, cartao_id: v, forma_pagamento: cart ? cart.codigo : "" })); }} options={[...(cartoes ?? [])].sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })).map(c => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} /></div>

                {/* Ajustes — só quando Valores Reais ≠ Cobrados. Campos por programa. */}
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
                    {/* Retarifação simples: só a marcação, mesma conta e mesmo programa. */}
                    {regra("ajuste_retarifacao") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao} onChange={e => setField("ajuste_retarifacao", e.target.checked)} /><span className="text-sm">Retarifação</span></label>
                    )}
                    {regraCabecalho("ajuste_retarifacao_outro_programa") && (
                      <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao_outro_programa} onChange={e => setForm(f => ({ ...f, ajuste_retarifacao_outro_programa: e.target.checked, programa_real: "", conta_id: "" }))} /><span className="text-sm">Retarifação (Outro Programa)</span></label>
                    )}
                    {/* Retarifação marcada: onde a emissão realmente saiu. Substitui a Conta do cabeçalho. */}
                    {retarifacaoAtiva && (
                      <>
                        <div className="grid gap-2"><Label>Programa Emitido *</Label><SearchSelect value={form.programa_real} onChange={setProgramaReal} options={(programas ?? []).filter((p: any) => p.nome !== form.programa).map((p: any) => ({ value: p.nome, label: p.nome }))} /></div>
                        <div className="grid gap-2"><Label>Conta *</Label><SearchSelect value={form.conta_id} onChange={v => setField("conta_id", v)} options={form.programa_real ? optContas(contasDoPrograma(form.programa_real)) : []} /></div>
                        <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
                          A baixa de estoque usa este Programa Emitido e esta Conta. O Programa do cabeçalho continua sendo o que o cliente pediu e é o que aparece na cobrança.
                        </p>
                      </>
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

            {/* Tab Cobrança */}
            <TabsContent value="pix" className="mt-0">
              <div className="space-y-4">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <Lock className="h-3.5 w-3.5" /> Dados da cobrança — preenchidos automaticamente pelo sistema. Somente leitura.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2"><Label>Forma de Cobrança</Label><Input value={ed?.forma_cobranca === "cartao" ? "Cartão" : ed?.forma_cobranca === "pix" ? "Pix" : ed?.forma_cobranca === "link" ? "Link (cliente escolhe)" : ed?.forma_cobranca === "avulso" ? "Recebimento Avulso" : "— (não cobrada)"} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Banco Emissor</Label><Input value={ed?.forma_cobranca === "avulso" ? ((ed as any)?.pix_banco || "—") : (ed as any)?.pix_banco === "sicredi" ? "Sicredi" : (ed as any)?.pix_banco === "c6" ? "C6 Bank" : "—"} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Status</Label><Input value={ed?.status_pix || form.status_pix || ""} readOnly disabled /></div>
                    {(ed as any)?.forma_paga && (
                      <div className="grid gap-2"><Label>Pago com</Label><Input value={(ed as any).forma_paga === "cartao" ? "Cartão" : "Pix"} readOnly disabled /></div>
                    )}
                    <div className="grid gap-2"><Label>Valor Recebido</Label><Input value={ed?.valor_recebido ? `R$ ${Number(ed.valor_recebido).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : ""} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>Data Recebimento</Label><Input value={ed?.data_recebimento ? new Date(ed.data_recebimento).toLocaleDateString("pt-BR") : ""} readOnly disabled /></div>
                    <div className="grid gap-2"><Label>ID Emissão</Label><Input value={ed?.id_emissao || (editing ? "" : "Gerado ao salvar")} readOnly disabled /></div>

                    {/* Campos específicos de Pix */}
                    {ed?.forma_cobranca === "pix" && (<>
                      <div className="grid gap-2"><Label>TXID (Pix)</Label><Input value={(ed as any)?.pix_txid || form.txid || ""} readOnly disabled /></div>
                      <div className="col-span-2 grid gap-2"><Label>Pix Copia e Cola</Label><Textarea value={(ed as any)?.pix_copia_cola || ""} readOnly disabled rows={2} className="font-mono text-xs" /></div>
                    </>)}

                    {/* Campos do checkout (cartão ou link de escolha) */}
                    {(ed?.forma_cobranca === "cartao" || ed?.forma_cobranca === "link") && (<>
                      <div className="grid gap-2"><Label>Status do Checkout</Label><Input value={(ed as any)?.checkout_status || ""} readOnly disabled /></div>
                      <div className="grid gap-2"><Label>ID do Checkout</Label><Input value={(ed as any)?.checkout_id || ""} readOnly disabled /></div>
                      <div className="col-span-2 grid gap-2"><Label>Link de Pagamento (Cartão)</Label><Input value={(ed as any)?.checkout_url || ""} readOnly disabled className="font-mono text-xs" /></div>
                    </>)}

                    <div className="col-span-2 grid gap-2"><Label>Observação</Label><Textarea value={ed?.obs_pix || form.obs_pix || ""} readOnly disabled rows={2} /></div>
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

      {/* Confirmação de cobrança - revisão dos dados */}
      <Dialog open={confirmarCobranca} onOpenChange={setConfirmarCobranca}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar cobrança</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2 text-sm">
            <p className="text-muted-foreground">Confira os dados antes de enviar a cobrança:</p>
            <div className="rounded-lg border divide-y">
              {[
                ["Localizador", form.localizador],
                ["Cliente", nomeCliente(form.cliente_id)],
                ["Conta", nomeConta(form.conta_id)],
                ["Cartão Utilizado", nomeCartao(form.cartao_id)],
                ["Programa", form.programa],
                ["Qtde Milhas", (form.milhas_cobrado || 0).toLocaleString("pt-BR")],
                ["Preço Milheiro", fmtMoeda(form.preco_milheiro)],
                ["Taxas", form.taxas_tipo === "milhas" ? `${(form.taxas_cobrado || 0).toLocaleString("pt-BR")} milhas` : fmtMoeda(form.taxas_cobrado)],
                ["Bagagens", form.bagagens_tipo === "milhas" ? `${(form.bagagens_cobrado || 0).toLocaleString("pt-BR")} milhas` : fmtMoeda(form.bagagens_cobrado)],
                ["Assentos", form.assentos_tipo === "milhas" ? `${(form.assentos_cobrado || 0).toLocaleString("pt-BR")} milhas` : fmtMoeda(form.assentos_cobrado)],
                ["Outros", fmtMoeda(form.outros_cobrado)],
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
