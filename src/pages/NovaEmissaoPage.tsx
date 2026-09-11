import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUpsertEmissao, useClientes, useContas, useCartoes, useProgramas, useOperacoes, useEmissores, useOrigens, useContaProgramas, useMoedasDoPrograma } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SearchSelect } from "@/components/ui/search-select";
import { NumericInput } from "@/components/ui/numeric-input";
import { toast } from "sonner";
import { CampoErro } from "@/components/ui/campo-erro";
import { AjudaButton } from "@/components/AjudaButton";
import { vLocalizador, vCodigoLA, vMilhas, vNaoNegativo, vNumPax, vDataVoo, dataVooMax } from "@/lib/validacoesEmissao";
import { reaisDiferemDosCobrados, temAlgumAjuste, DICA_CONTA, DICA_CONTA_RETARIFADA } from "@/lib/ajustesEmissao";
import { DicaCampo } from "@/components/ui/dica-campo";
import { useRegras, MILHAS_MIN_PADRAO, MILHAS_MIN_FRACIONADO } from "@/lib/regrasPrograma";
import { CampoValorEmissao, camposCambioParaSalvar, valorEmReais, vCamposEmMoeda } from "@/components/CampoValorEmissao";
import { ArrowLeft, Plane, Copy } from "lucide-react";

const emptyForm = {
  data_emissao: "",
  hora: "",
  localizador: "", programa: "", nome_operacao: "", data_voo_ida: "", emissor: "",
  conta_id: "", cliente_id: "", passageiros_qtd: "" as unknown as number,
  cpfs_otimizados: "",
  milhas_cobrado: 0, preco_milheiro: 0, taxas_cobrado: 0, bagagens_cobrado: 0, assentos_cobrado: 0, outros_cobrado: 0, outros_descricao: "", preco_total: 0,
  taxas_tipo: "reais", bagagens_tipo: "reais", assentos_tipo: "reais", outros_tipo: "reais",
  milhas_real: 0, taxas_real: 0, bagagens_real: 0, assentos_real: 0, outros_real: 0,
  taxas_real_tipo: "reais", bagagens_real_tipo: "reais", assentos_real_tipo: "reais", outros_real_tipo: "reais",
  // Câmbio (só quando o tipo do campo é "moeda") — ver components/CampoValorEmissao.tsx
  taxas_moeda: null as string | null, taxas_valor_moeda: null as number | null, taxas_cotacao: null as number | null,
  bagagens_moeda: null as string | null, bagagens_valor_moeda: null as number | null, bagagens_cotacao: null as number | null,
  assentos_moeda: null as string | null, assentos_valor_moeda: null as number | null, assentos_cotacao: null as number | null,
  outros_moeda: null as string | null, outros_valor_moeda: null as number | null, outros_cotacao: null as number | null,
  taxas_real_moeda: null as string | null, taxas_real_valor_moeda: null as number | null, taxas_real_cotacao: null as number | null,
  bagagens_real_moeda: null as string | null, bagagens_real_valor_moeda: null as number | null, bagagens_real_cotacao: null as number | null,
  assentos_real_moeda: null as string | null, assentos_real_valor_moeda: null as number | null, assentos_real_cotacao: null as number | null,
  outros_real_moeda: null as string | null, outros_real_valor_moeda: null as number | null, outros_real_cotacao: null as number | null,
  ajuste_cupom: "", ajuste_hack_upgrade: false, ajuste_retarifacao: false, ajuste_taxa_resgate: false, ajuste_desconto_promo: false, ajuste_campo_aberto: "",
  ajuste_retarifacao_outro_programa: false, programa_real: "",
  cartao_id: "", forma_pagamento: "", codigo_la: "", percentual_cb: 0, origem_venda: "",
  observacao: "", facial: null as boolean | null, nota: "",
  compra_apos_bagagens: false, compra_apos_assentos: false,
};

function Secao({ titulo, plain, children }: { titulo?: string; plain?: boolean; children: React.ReactNode }) {
  return (
    <Card className="p-5 space-y-4">
      {titulo && <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{titulo}</h3>}
      {plain
        ? <div className="space-y-4">{children}</div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{children}</div>}
    </Card>
  );
}

// Linha de campos com a mesma grade padrão (até 4 por linha no desktop).
function Linha({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{children}</div>;
}

export default function NovaEmissaoPage() {
  const navigate = useNavigate();
  const upsert = useUpsertEmissao();
  const { data: clientes } = useClientes();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: programas } = useProgramas();
  const { data: contaProgramas } = useContaProgramas();
  const { data: operacoes } = useOperacoes();
  const { data: emissores } = useEmissores();
  const { data: origens } = useOrigens();
  // data/hora são calculadas no momento em que a tela monta (ao clicar em Nova Emissão),
  // por isso ficam aqui e não na const emptyForm (que congelaria o horário no boot do app).
  const [form, setForm] = useState(() => {
    const agora = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return {
      ...emptyForm,
      // data e hora LOCAIS do momento em que a tela abriu (sem converter para UTC)
      data_emissao: `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`,
      hora: `${p(agora.getHours())}:${p(agora.getMinutes())}`,
    };
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
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
  const precoTotal = useMemo(
    () => Math.round((form.milhas_cobrado * form.preco_milheiro / 1000 + valorTaxas + valorBagagens + valorAssentos + valorOutros) * 100) / 100,
    [form.milhas_cobrado, form.preco_milheiro, valorTaxas, valorBagagens, valorAssentos, valorOutros]
  );

  // Com retarifação, o "Programa Emitido" + "Conta" do bloco de Ajustes substituem a Conta do
  // cabeçalho — é esse par que baixa o estoque. O Programa do cabeçalho (o que o cliente pediu)
  // continua intocado e é o que aparece na cobrança.
  const estoqueDoPrograma =(nome: string) => (programas ?? []).find((p: any) => p.nome === nome)?.programa_estoque_id;
  const contasDoPrograma = (nome: string) => {
    const est = estoqueDoPrograma(nome);
    return est ? (contas ?? []).filter((c: any) => contaProgramas?.[c.id]?.has(est) ?? false) : [];
  };
  const optContas = (lista: any[]) => [...lista]
    .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
    .map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }));
  // Troca o programa emitido; se a conta escolhida não participar dele, limpa para forçar nova escolha.
  const setProgramaReal = (v: string) => setForm((f) => {
    const ok = contasDoPrograma(v).some((c: any) => c.id === f.conta_id);
    return { ...f, programa_real: v, conta_id: ok ? f.conta_id : "" };
  });

  // Programas filtrados pela conta selecionada (e contas filtradas pelo programa) — bidirecional.
  // Com retarifação, a conta gravada é a do programa emitido: ela não pode filtrar o Programa do cabeçalho.
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
    if (!form.data_voo_ida) return "Informe a Data do Voo (Ida).";
    { const e = vDataVoo(form.data_voo_ida, form.data_emissao); if (e) return e; }
    if (!form.emissor) return "Selecione o Emissor.";
    if (!retarifacaoAtiva && !form.conta_id) return "Selecione a Conta.";
    if (!form.cliente_id) return "Selecione o Cliente.";
    if (!form.passageiros_qtd || form.passageiros_qtd < 1) return "Informe o Nº de Pax.";
    if (!form.cartao_id) return "Selecione o Cartão Utilizado.";
    if (!form.origem_venda) return "Selecione a Origem.";
    if (regra("codigo_la") && !form.codigo_la) return `Código LA é obrigatório para emissões ${programaEfetivo}.`;
    if (form.outros_cobrado > 0 && !form.outros_descricao.trim()) return "Descreva o que é a cobrança em 'Outros'.";
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

  const salvar = async () => {
    const erro = validar();
    if (erro) { toast.error(erro); return; }
    setSalvando(true);
    const diff = reaisDiferemDosCobrados(form);
    try {
      const criada = await upsert.mutateAsync({
        ...form, preco_total: precoTotal,
        passageiros_qtd: Number(form.passageiros_qtd) || null,
        cliente_id: form.cliente_id || null, conta_id: form.conta_id || null, cartao_id: form.cartao_id || null,
        hora: form.hora || null, data_voo_ida: form.data_voo_ida || null,
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
        ajuste_campo_aberto: diff && regra("ajuste_campo_aberto") ? (form.ajuste_campo_aberto?.trim() || null) : null,
        // Programa onde a emissão realmente saiu (só com retarifação). A Conta gravada já é a desse programa.
        programa_real: retarifacaoAtiva ? (form.programa_real || null) : null,
        // Moeda/valor/cotação de cada campo — só grava em quem está em "moeda"
        ...camposCambioParaSalvar(form, permiteMoeda),
      });
      toast.success("Emissão criada!");
      // Vai direto para a lista já abrindo a confirmação de cobrança desta emissão.
      navigate("/emissoes", (criada as any)?.id ? { state: { cobrarEmissao: criada } } : undefined);
    } catch (err: any) {
      console.error("[EMISSAO] erro ao salvar:", err);
      toast.error(`Erro ao salvar: ${err?.message || err?.details || "Erro desconhecido."}`);
    } finally { setSalvando(false); }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/emissoes")}><ArrowLeft className="h-5 w-5" /></Button>
          <Plane className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Nova Emissão</h1>
          <span className="text-sm font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">ID gerado ao salvar</span>
          <AjudaButton chave="nova_emissao" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/emissoes")}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar Emissão"}</Button>
        </div>
      </div>

      {/* Ordem idêntica à planilha (colunas A → Y) */}
      <Secao titulo="Dados da Emissão">
        {/* A, B, C, D */}
        <div className="grid gap-1"><Label>Data Emissão *</Label><Input type="date" value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} /></div>
        <div className="grid gap-1"><Label>Hora *</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
        <div className="grid gap-1"><Label>Localizador *</Label><Input value={form.localizador} onChange={(e) => set("localizador", e.target.value.toUpperCase().slice(0, 13))} placeholder="ABC123" className={vLocalizador(form.localizador) ? "border-destructive" : ""} /><CampoErro msg={vLocalizador(form.localizador)} /></div>
        <div className="grid gap-1"><Label>Programa *</Label><SearchSelect value={form.programa} onChange={(v) => set("programa", v)} options={programasFiltrados.map((p) => ({ value: p.nome, label: p.nome }))} /></div>
        {/* E, F, G */}
        <div className="grid gap-1"><Label>Nome Operação *</Label><SearchSelect value={form.nome_operacao} onChange={(v) => set("nome_operacao", v)} options={(operacoes ?? []).map((o) => ({ value: o.nome, label: o.nome }))} /></div>
        <div className="grid gap-1"><Label>Data Voo Ida *</Label><Input type="date" max={dataVooMax()} value={form.data_voo_ida} onChange={(e) => set("data_voo_ida", e.target.value)} className={vDataVoo(form.data_voo_ida, form.data_emissao) ? "border-destructive" : ""} /><CampoErro msg={vDataVoo(form.data_voo_ida, form.data_emissao)} /></div>
        <div className="grid gap-1"><Label>Emissor *</Label><SearchSelect value={form.emissor} onChange={(v) => set("emissor", v)} options={(emissores ?? []).map((e) => ({ value: e.nome, label: e.nome }))} /></div>
        {/* H — com retarifação a Conta é escolhida no bloco de Ajustes (a do programa emitido). */}
        {retarifacaoAtiva
          ? (
            <div className="grid gap-1">
              <div className="flex items-center gap-1.5"><Label>Conta</Label><DicaCampo texto={DICA_CONTA_RETARIFADA} /></div>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-xs text-muted-foreground">Definida na Retarifação, mais abaixo</div>
            </div>
          )
          : (
            <div className="grid gap-1">
              <div className="flex items-center gap-1.5"><Label>Conta *</Label><DicaCampo texto={DICA_CONTA} /></div>
              <SearchSelect value={form.conta_id} onChange={(v) => set("conta_id", v)} options={optContas(contasFiltradas)} />
            </div>
          )}
        {/* I (Cliente, maior) + J */}
        <div className="grid gap-1 col-span-2"><Label>Cliente *</Label><SearchSelect value={form.cliente_id} onChange={(v) => set("cliente_id", v)} options={[...(clientes ?? [])].sort((a, b) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })).map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome_fantasia || c.razao_social || ""}` }))} /></div>
        <div className="grid gap-1"><Label>Nº Pax *</Label><Input type="number" min={1} value={form.passageiros_qtd ?? ""} onChange={(e) => set("passageiros_qtd", e.target.value === "" ? "" : (parseInt(e.target.value) || 0))} className={vNumPax(form.passageiros_qtd) ? "border-destructive" : ""} /><CampoErro msg={vNumPax(form.passageiros_qtd)} /></div>
        {regra("cpfs_otimizados") && (
          <div className="grid gap-1"><Label>CPFs Otimizados</Label><Input type="number" min={1} max={form.passageiros_qtd || undefined} value={form.cpfs_otimizados} onChange={(e) => set("cpfs_otimizados", e.target.value)} placeholder="Opcional" /></div>
        )}
        {/* Origem: campo geral (todos os programas) */}
        <div className="grid gap-1"><Label>Origem *</Label><SearchSelect value={form.origem_venda} onChange={(v) => set("origem_venda", v)} options={(origens ?? []).map((o) => ({ value: o.nome, label: o.nome }))} /></div>
        {/* Campos liberados por regra do programa: Código LA, % Cashback e Pagar facial */}
        {regra("codigo_la") && (
          <div className="grid gap-1"><Label>Código LA *</Label><Input value={form.codigo_la} onChange={(e) => set("codigo_la", e.target.value.toUpperCase())} placeholder="LA123" className={vCodigoLA(form.codigo_la, true) ? "border-destructive" : ""} /><CampoErro msg={vCodigoLA(form.codigo_la, true)} /></div>
        )}
        {regra("percentual_cb") && (
          <div className="grid gap-1"><Label>% Cashback</Label><NumericInput value={form.percentual_cb} onChange={(n) => set("percentual_cb", n)} decimal /></div>
        )}
        {regra("facial") && (
          <div className="grid gap-1">
            <Label>Pagar facial?</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => set("facial", true)} className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${form.facial === true ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>Sim</button>
              <button type="button" onClick={() => set("facial", false)} className={`flex-1 h-10 rounded-md border text-sm font-medium transition-colors ${form.facial === false ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>Não</button>
            </div>
          </div>
        )}
      </Secao>

      {/* K, L, M, N, O */}
      <Secao titulo="Valores Cobrados" plain>
        {/* Milhas e Preço do Milheiro sempre na primeira linha */}
        <Linha>
          <div className="grid gap-1"><Label>Qtde Milhas *</Label><NumericInput value={form.milhas_cobrado} onChange={(n) => set("milhas_cobrado", n)} error={!!vMilhas(form.milhas_cobrado, milhasMin)} /><CampoErro msg={vMilhas(form.milhas_cobrado, milhasMin)} /></div>
          <div className="grid gap-1"><Label>Preço Milheiro *</Label><NumericInput value={form.preco_milheiro} onChange={(n) => set("preco_milheiro", n)} decimal prefix="R$" /></div>
        </Linha>
        {/* Taxas, Bagagens, Assentos e Outros na linha de baixo */}
        <Linha>
          <CampoValorEmissao label="Taxas" campo="taxas" bloco="cobrado" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
          <CampoValorEmissao label="Bagagens" campo="bagagens" bloco="cobrado" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
          <CampoValorEmissao label="Assentos" campo="assentos" bloco="cobrado" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
          <CampoValorEmissao label="Outros" campo="outros" bloco="cobrado" form={form} setForm={setForm} permiteMilhas={false} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
        </Linha>
        {form.outros_cobrado > 0 && (
          <div className="grid gap-1">
            <Label>Descrição de "Outros" *</Label>
            <Input value={form.outros_descricao} onChange={(e) => set("outros_descricao", e.target.value)} placeholder="Sobre o que é essa cobrança?" />
          </div>
        )}
        <Linha>
          <div className="grid gap-1"><Label>Preço Total</Label><Input readOnly disabled value={precoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} className="bg-muted font-semibold text-right" /></div>
        </Linha>
      </Secao>

      {/* P, Q, R */}
      <Secao titulo="Valores Reais" plain>
        <div className="-mb-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({
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
            <Copy className="h-3.5 w-3.5 mr-1" />Copiar dos Valores Cobrados
          </Button>
        </div>
        {/* Qtde Milhas sempre na primeira linha */}
        <Linha>
          <div className="grid gap-1"><Label>Qtde Milhas *</Label><NumericInput value={form.milhas_real} onChange={(n) => set("milhas_real", n)} error={!!vMilhas(form.milhas_real, milhasMin)} /><CampoErro msg={vMilhas(form.milhas_real, milhasMin)} /></div>
        </Linha>
        {/* Taxas, Bagagens, Assentos e Outros na linha de baixo */}
        <Linha>
          <CampoValorEmissao label="Taxas *" campo="taxas" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
          <CampoValorEmissao label="Bagagens" campo="bagagens" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
          <CampoValorEmissao label="Assentos" campo="assentos" bloco="real" form={form} setForm={setForm} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
          <CampoValorEmissao label="Outros *" campo="outros" bloco="real" form={form} setForm={setForm} permiteMilhas={false} moedas={moedasPrograma} aceitaReais={aceitaReais} carregando={carregandoMoedas} />
        </Linha>
        {/* "Compra após emissão" — alinhado sob Bagagens e Assentos */}
        <Linha>
          <div className="hidden md:block" />
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.compra_apos_bagagens} onChange={(e) => set("compra_apos_bagagens", e.target.checked)} />
            <span>Bagagens: compra após emissão</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.compra_apos_assentos} onChange={(e) => set("compra_apos_assentos", e.target.checked)} />
            <span>Assentos: compra após emissão</span>
          </label>
          <div className="hidden md:block" />
        </Linha>
        <Linha>
          <div className="grid gap-1"><Label>Cartão Utilizado *</Label><SearchSelect value={form.cartao_id} onChange={(v) => { const cart = (cartoes ?? []).find((c) => c.id === v); setForm((f) => ({ ...f, cartao_id: v, forma_pagamento: cart ? cart.codigo : "" })); }} options={[...(cartoes ?? [])].sort((a, b) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })).map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} /></div>
        </Linha>
      </Secao>

      {/* Ajustes — só quando Valores Reais ≠ Cobrados. Campos liberados por programa. */}
      {reaisDiferemDosCobrados(form) && (
        <Secao titulo="Ajustes (Valores Reais ≠ Cobrados)">
          <p className="col-span-2 md:col-span-4 -mt-1 text-xs text-muted-foreground">
            Os valores reais diferem dos cobrados. Preencha ao menos um campo abaixo para justificar a diferença.
          </p>
          {regra("ajuste_cupom") && (
            <div className="grid gap-1"><Label>Cupom (%)</Label><NumericInput value={Number(form.ajuste_cupom) || 0} onChange={(n) => set("ajuste_cupom", String(n))} decimal /></div>
          )}
          {regra("ajuste_hack_upgrade") && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_hack_upgrade} onChange={(e) => setForm((f) => ({ ...f, ajuste_hack_upgrade: e.target.checked }))} /><span className="text-sm">Hack Upgrade</span></label>
          )}
          {/* Retarifação simples: só a marcação, mesma conta e mesmo programa. */}
          {regra("ajuste_retarifacao") && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao} onChange={(e) => setForm((f) => ({ ...f, ajuste_retarifacao: e.target.checked }))} /><span className="text-sm">Retarifação</span></label>
          )}
          {regraCabecalho("ajuste_retarifacao_outro_programa") && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao_outro_programa} onChange={(e) => setForm((f) => ({ ...f, ajuste_retarifacao_outro_programa: e.target.checked, programa_real: "", conta_id: "" }))} /><span className="text-sm">Retarifação (Outro Programa)</span></label>
          )}
          {/* Retarifação (Outro Programa) marcada: onde a emissão realmente saiu. Substitui a Conta do cabeçalho. */}
          {retarifacaoAtiva && (
            <>
              <div className="grid gap-1"><Label>Programa Emitido *</Label><SearchSelect value={form.programa_real} onChange={setProgramaReal} options={(programas ?? []).filter((p: any) => p.nome !== form.programa).map((p: any) => ({ value: p.nome, label: p.nome }))} /></div>
              <div className="grid gap-1"><Label>Conta *</Label><SearchSelect value={form.conta_id} onChange={(v) => set("conta_id", v)} options={form.programa_real ? optContas(contasDoPrograma(form.programa_real)) : []} /></div>
              <p className="col-span-2 md:col-span-4 -mt-2 text-xs text-muted-foreground">
                A baixa de estoque usa este Programa Emitido e esta Conta. O Programa do cabeçalho continua sendo o que o cliente pediu e é o que aparece na cobrança.
              </p>
            </>
          )}
          {regra("ajuste_taxa_resgate") && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_taxa_resgate} onChange={(e) => setForm((f) => ({ ...f, ajuste_taxa_resgate: e.target.checked }))} /><span className="text-sm">Taxa de Resgate</span></label>
          )}
          {regra("ajuste_desconto_promo") && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_desconto_promo} onChange={(e) => setForm((f) => ({ ...f, ajuste_desconto_promo: e.target.checked }))} /><span className="text-sm">Desconto Promocional</span></label>
          )}
          {regra("ajuste_campo_aberto") && (
            <div className="grid gap-1 col-span-2 md:col-span-4"><Label>Campo Aberto</Label><Textarea value={form.ajuste_campo_aberto} onChange={(e) => set("ajuste_campo_aberto", e.target.value)} rows={2} placeholder="Descreva o motivo da diferença..." /></div>
          )}
        </Secao>
      )}

      {/* Observação (sem título de seção) */}
      <Secao>
        <div className="grid gap-1 col-span-2 md:col-span-4"><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} placeholder="Observações adicionais..." /></div>
      </Secao>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => navigate("/emissoes")}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar Emissão"}</Button>
      </div>
    </div>
  );
}
