import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEstoqueTransferencias, useSalvarTransferencia, useProgramasEstoque, qtdeCarrinho } from "@/hooks/useClubes";
import { useContas, useCartoes, useContaProgramas, useBancos } from "@/hooks/useData";
import { usePromocoes, bonusComTeto, programasDaPromocao } from "@/hooks/usePromocoes";
import { useConversoesEstoque, mapaConversoes, destinatarioLabel } from "@/hooks/useConversoesEstoque";
import { vData } from "@/lib/validacoesData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const isoHoje = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const horaAgora = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
};

const calcParcela = (custo: string, parcelas: string) => {
  const c = Number(custo) || 0;
  const n = Number(parcelas) || 0;
  return c > 0 && n > 0 ? (c / n).toFixed(2) : "";
};
const nf = (n: number) => (Number(n) || 0).toLocaleString("pt-BR");
const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const emptyForm = {
  data: isoHoje(),
  hora: "",
  conta_remetente_id: "", programa_estoque_remetente_id: "",
  conta_recebedora_id: "", programa_estoque_recebedor_id: "",
  promocao_id: "",
  qtde_transferida: "", bonus_pct: "", carrinho_pct: "",
  custo_total: "", num_parcelas: "", meio_pagamento: "cartao", forma_pagamento: "", banco_id: "",
  valor_parcela: "", descricao: "",
};

export default function NovaTransferenciaPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const { data: transfers } = useEstoqueTransferencias();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: bancos } = useBancos();
  const { data: estoques } = useProgramasEstoque();
  const { data: contaProgramas } = useContaProgramas();
  const { data: promocoes } = usePromocoes();
  const { data: conversoes } = useConversoesEstoque();
  const salvar = useSalvarTransferencia();

  const [form, setForm] = useState(() => ({ ...emptyForm, hora: horaAgora() }));
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    const t = (transfers ?? []).find((x: any) => x.id === id);
    if (!t) return;
    setForm({
      data: t.data ?? isoHoje(),
      hora: t.hora ?? "",
      conta_remetente_id: t.conta_remetente_id ?? "", programa_estoque_remetente_id: t.programa_estoque_remetente_id ?? "",
      conta_recebedora_id: t.conta_recebedora_id ?? "", programa_estoque_recebedor_id: t.programa_estoque_recebedor_id ?? "",
      promocao_id: t.promocao_id ?? "",
      qtde_transferida: t.qtde_transferida?.toString() ?? "",
      bonus_pct: t.bonus != null ? String(Number(t.bonus) * 100) : "",
      carrinho_pct: t.carrinho != null ? String(Number(t.carrinho) * 100) : "",
      custo_total: t.custo_total?.toString() ?? "", num_parcelas: t.num_parcelas?.toString() ?? "",
      meio_pagamento: t.meio_pagamento ?? "cartao", forma_pagamento: t.forma_pagamento ?? "", banco_id: t.banco_id ?? "",
      valor_parcela: t.valor_parcela?.toString() ?? "", descricao: t.descricao ?? "",
    });
  }, [editing, id, transfers]);

  // Só as contas que participam do programa escolhido (mesma regra das Emissões)
  const contasDoPrograma = (estoqueId: string, contaAtual: string) => {
    const lista = (contas ?? []).slice()
      .filter((c: any) => !!estoqueId && (contaProgramas?.[c.id]?.has(estoqueId) ?? false))
      .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
      .map((c: any) => ({ value: c.id, label: c.codigo || c.nome || "", searchText: c.nome || "" }));
    // ao editar, a conta já gravada continua aparecendo mesmo que não participe mais do programa
    if (contaAtual && !lista.some((o) => o.value === contaAtual)) {
      const c = (contas ?? []).find((x: any) => x.id === contaAtual);
      if (c) lista.unshift({ value: c.id, label: c.codigo || c.nome || "", searchText: c.nome || "" });
    }
    return lista;
  };
  const contasOrigem = useMemo(
    () => contasDoPrograma(form.programa_estoque_remetente_id, form.conta_remetente_id),
    [contas, contaProgramas, form.programa_estoque_remetente_id, form.conta_remetente_id]
  );
  const contasDestino = useMemo(
    () => contasDoPrograma(form.programa_estoque_recebedor_id, form.conta_recebedora_id),
    [contas, contaProgramas, form.programa_estoque_recebedor_id, form.conta_recebedora_id]
  );
  // Trocar o programa limpa a conta quando ela não participa do novo programa
  const setProgramaOrigem = (v: string) => setForm((f) => ({
    ...f, programa_estoque_remetente_id: v,
    conta_remetente_id: f.conta_remetente_id && (contaProgramas?.[f.conta_remetente_id]?.has(v) ?? false) ? f.conta_remetente_id : "",
  }));
  const setProgramaDestino = (v: string) => setForm((f) => ({
    ...f, programa_estoque_recebedor_id: v,
    conta_recebedora_id: f.conta_recebedora_id && (contaProgramas?.[f.conta_recebedora_id]?.has(v) ?? false) ? f.conta_recebedora_id : "",
  }));
  const cartaoOptions = useMemo(
    () => (cartoes ?? []).slice()
      .map((c: any) => ({ value: c.codigo || c.nome || "", label: c.codigo || c.nome || "" }))
      .filter((o: any) => o.value)
      .sort((a: any, b: any) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })),
    [cartoes]
  );
  // Pix: o banco vem do cadastro Configurações › Bancos
  const ehPix = form.meio_pagamento === "pix";
  const bancoOptions = useMemo(
    () => (bancos ?? []).map((b: any) => ({ value: b.id, label: b.nome })),
    [bancos]
  );
  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).map((e: any) => ({ id: e.id, nome: e.nome })),
    [estoques]
  );

  // Promoções de transferência vigentes na data do lançamento (a promoção vem antes dos programas)
  const promocaoOptions = useMemo(() => {
    const lista = (promocoes ?? []).filter((p: any) => {
      if (p.tipo !== "transferencia" || p.ativo === false) return false;
      const dia = form.data || "";
      if (dia && p.vigencia_inicio && dia < String(p.vigencia_inicio).slice(0, 10)) return false;
      if (dia && p.vigencia_fim && dia > String(p.vigencia_fim).slice(0, 10)) return false;
      return true;
    }).map((p: any) => ({ value: p.id, label: p.nome }));
    // ao editar, mantém a promoção já gravada mesmo que hoje ela não se encaixe
    if (form.promocao_id && !lista.some((o: any) => o.value === form.promocao_id)) {
      const p = (promocoes ?? []).find((x: any) => x.id === form.promocao_id);
      if (p) lista.unshift({ value: p.id, label: p.nome });
    }
    return [{ value: "__none", label: "— sem promoção —" }, ...lista];
  }, [promocoes, form.data, form.promocao_id]);

  const promocao = useMemo(
    () => (promocoes ?? []).find((p: any) => p.id === form.promocao_id),
    [promocoes, form.promocao_id]
  );
  // Com promoção escolhida, só aparecem os programas configurados nela (lista vazia = todos)
  const programasPermitidos = (papel: "origem" | "destino") => {
    const ids = promocao ? programasDaPromocao(promocao, papel) : [];
    return (estoques ?? []).filter((e: any) => e.ativo !== false && (ids.length === 0 || ids.includes(e.id)))
      .map((e: any) => ({ id: e.id, nome: e.nome }));
  };
  const estoqueOrigemOptions = useMemo(() => programasPermitidos("origem"), [estoques, promocao]);
  const estoqueDestinoOptions = useMemo(() => programasPermitidos("destino"), [estoques, promocao]);

  // Escolher a promoção traz o % de bônus dela e limpa programas que ela não cobre
  const setPromocao = (v: string) => setForm((f) => {
    const pid = v === "__none" ? "" : v;
    const p = (promocoes ?? []).find((x: any) => x.id === pid);
    const okOrigem = !p || programasDaPromocao(p, "origem").length === 0 || programasDaPromocao(p, "origem").includes(f.programa_estoque_remetente_id);
    const okDestino = !p || programasDaPromocao(p, "destino").length === 0 || programasDaPromocao(p, "destino").includes(f.programa_estoque_recebedor_id);
    return {
      ...f,
      promocao_id: pid,
      bonus_pct: p ? String(Number(p.bonus_pct || 0) * 100) : f.bonus_pct,
      programa_estoque_remetente_id: okOrigem ? f.programa_estoque_remetente_id : "",
      conta_remetente_id: okOrigem ? f.conta_remetente_id : "",
      programa_estoque_recebedor_id: okDestino ? f.programa_estoque_recebedor_id : "",
      conta_recebedora_id: okDestino ? f.conta_recebedora_id : "",
    };
  });

  // Teto da promoção: soma o que ela já bonificou nessa conta de destino
  const jaBonificado = useMemo(() => {
    if (!form.promocao_id || !form.conta_recebedora_id) return 0;
    return (transfers ?? [])
      .filter((t: any) => t.promocao_id === form.promocao_id && t.conta_recebedora_id === form.conta_recebedora_id && t.id !== id)
      .reduce((s: number, t: any) => s + (Number(t.bonus_milhas) || 0), 0);
  }, [transfers, form.promocao_id, form.conta_recebedora_id, id]);

  // Conversão do par origem → destino (Configurações › Programas Estoque › aba Conversões).
  // Sem conversão cadastrada, a transferência é 1:1.
  const conversao = useMemo(
    () => (form.programa_estoque_remetente_id && form.programa_estoque_recebedor_id)
      ? mapaConversoes(conversoes).get(`${form.programa_estoque_remetente_id}|${form.programa_estoque_recebedor_id}`)
      : undefined,
    [conversoes, form.programa_estoque_remetente_id, form.programa_estoque_recebedor_id]
  );
  const fator = Number(conversao?.fator) > 0 ? Number(conversao.fator) : 1;
  const nomeEstoque = (eid: string) => (estoques ?? []).find((e: any) => e.id === eid)?.nome ?? "";
  const contaCodigo = (cid: string) => {
    const c = (contas ?? []).find((x: any) => x.id === cid);
    return c ? (c.codigo || c.nome || "") : "";
  };

  // "Mesmo CPF": a conta que recebe é a mesma da origem — nem oferece lista de contas.
  const soMesmoCpf = conversao?.destinatario === "mesmo_cpf";
  useEffect(() => {
    if (!soMesmoCpf || !form.conta_remetente_id) return;
    if (form.conta_recebedora_id === form.conta_remetente_id) return;
    setForm((f) => ({ ...f, conta_recebedora_id: f.conta_remetente_id }));
  }, [soMesmoCpf, form.conta_remetente_id, form.conta_recebedora_id]);

  const milhasCarrinho = useMemo(
    () => qtdeCarrinho(Number(form.qtde_transferida) || 0, (Number(form.carrinho_pct) || 0) / 100),
    [form.qtde_transferida, form.carrinho_pct]
  );
  // O carrinho é sempre um % da transferência, mas dá para digitar as milhas: o % é recalculado.
  const setCarrinhoPorMilhas = (milhas: number) => {
    const transferida = Number(form.qtde_transferida) || 0;
    if (transferida <= 0) { toast.error("Informe primeiro a quantidade transferida."); return; }
    set("carrinho_pct", String(((Number(milhas) || 0) / transferida) * 100));
  };
  // A Qtde transferida é o TOTAL que entra na transferência; o carrinho é a parte dela que foi
  // comprada, então só o restante sai do estoque de origem.
  const saiDoEstoque = Math.max(0, (Number(form.qtde_transferida) || 0) - milhasCarrinho);
  // A paridade converte antes do bônus: 35.000 com fator 3,5 viram 10.000 no destino.
  const base = Math.round((Number(form.qtde_transferida) || 0) / fator);
  const calcBonus = useMemo(
    () => bonusComTeto(base, (Number(form.bonus_pct) || 0) / 100, promocao?.bonus_maximo ?? null, jaBonificado),
    [base, form.bonus_pct, promocao, jaBonificado]
  );
  const recebida = base + calcBonus.bonus;
  // Quanto custa o milheiro que entra no destino (custo total / milhas recebidas)
  const custoMilheiroDestino = recebida > 0 ? (Number(form.custo_total) || 0) / (recebida / 1000) : 0;

  const voltar = () => navigate("/estoque-transferencias");

  const handleSave = async () => {
    // Todos os campos são obrigatórios — sem custo, preencha com 0. (Descrição é anotação livre.)
    if (!form.data) { toast.error("Informe a data."); return; }
    const erroData = vData(form.data);
    if (erroData) { toast.error(erroData); return; }
    if (!form.hora) { toast.error("Informe a hora."); return; }
    if (!form.programa_estoque_remetente_id) { toast.error("Selecione o programa de origem."); return; }
    if (!form.conta_remetente_id) { toast.error("Selecione a conta de origem."); return; }
    if (!form.programa_estoque_recebedor_id) { toast.error("Selecione o programa de destino."); return; }
    if (!form.conta_recebedora_id) { toast.error("Selecione a conta de destino."); return; }
    if (!(Number(form.qtde_transferida) > 0)) { toast.error("Informe a quantidade transferida."); return; }
    if (form.bonus_pct === "") { toast.error("Informe o bônus (%) — use 0 se não houve bônus."); return; }
    if (form.carrinho_pct === "") { toast.error("Informe o carrinho (%) — use 0 se não houve carrinho."); return; }
    if (form.custo_total === "") { toast.error("Informe o custo total — use 0 se não houve custo."); return; }
    if (ehPix) {
      if (Number(form.custo_total) > 0 && !form.banco_id) { toast.error("Selecione o banco do Pix."); return; }
    } else {
      if (form.num_parcelas === "") { toast.error("Informe o número de parcelas."); return; }
      if (Number(form.custo_total) > 0 && !form.forma_pagamento) { toast.error("Selecione o cartão."); return; }
    }
    if (form.conta_remetente_id === form.conta_recebedora_id && form.programa_estoque_remetente_id === form.programa_estoque_recebedor_id) {
      toast.error("Origem e destino não podem ser o mesmo par conta/programa."); return;
    }
    try {
      await salvar.mutateAsync({
        id: editing ? id : undefined,
        data: form.data,
        hora: form.hora || null,
        conta_remetente_id: form.conta_remetente_id, programa_estoque_remetente_id: form.programa_estoque_remetente_id,
        conta_recebedora_id: form.conta_recebedora_id, programa_estoque_recebedor_id: form.programa_estoque_recebedor_id,
        qtde_transferida: Number(form.qtde_transferida) || 0,
        bonus: (Number(form.bonus_pct) || 0) / 100,
        carrinho: (Number(form.carrinho_pct) || 0) / 100,
        promocao_id: form.promocao_id || null,
        bonus_milhas: calcBonus.bonus,
        fator_conversao: fator,
        custo_total: form.custo_total === "" ? null : Number(form.custo_total),
        num_parcelas: ehPix ? null : (form.num_parcelas === "" ? null : Number(form.num_parcelas)),
        meio_pagamento: form.meio_pagamento,
        banco_id: ehPix ? (form.banco_id || null) : null,
        forma_pagamento: ehPix ? null : (form.forma_pagamento || null),
        valor_parcela: form.valor_parcela === "" ? null : Number(form.valor_parcela),
        descricao: form.descricao || null,
      });
      toast.success(editing ? "Transferência atualizada!" : "Transferência lançada — origem descontada e destino somado.");
      voltar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar transferência"); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Nova"} Transferência</h1>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-md">
            <div className="grid gap-1"><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Hora *</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
          </div>

          <div className="grid gap-1 sm:max-w-md"><Label>Promoção</Label>
            <SearchSelect value={form.promocao_id || "__none"} onChange={setPromocao} options={promocaoOptions}
              placeholder="— sem promoção —" emptyText="Nenhuma promoção vigente nesta data" />
            {promocao && <p className="text-xs text-muted-foreground">Só aparecem os programas configurados nesta promoção.</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-sm font-medium text-destructive">Origem (sai −)</div>
              <div className="grid gap-1"><Label>Programa *</Label>
                <Select value={form.programa_estoque_remetente_id} onValueChange={setProgramaOrigem}>
                  <SelectTrigger><SelectValue placeholder="Programa de origem" /></SelectTrigger>
                  <SelectContent>
                    {estoqueOrigemOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa disponível</div>
                    ) : estoqueOrigemOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1"><Label>Conta *</Label>
                <SearchSelect value={form.conta_remetente_id} onChange={(v) => set("conta_remetente_id", v)} options={contasOrigem}
                  placeholder={form.programa_estoque_remetente_id ? "Conta de origem" : "Selecione o programa primeiro"}
                  emptyText="Nenhuma conta neste programa" />
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-sm font-medium text-emerald-600">Destino (entra +)</div>
              <div className="grid gap-1"><Label>Programa *</Label>
                <Select value={form.programa_estoque_recebedor_id} onValueChange={setProgramaDestino}>
                  <SelectTrigger><SelectValue placeholder="Programa de destino" /></SelectTrigger>
                  <SelectContent>
                    {estoqueDestinoOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa disponível</div>
                    ) : estoqueDestinoOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1"><Label>Conta *</Label>
                {soMesmoCpf ? (
                  <>
                    <Input value={contaCodigo(form.conta_recebedora_id) || "—"} readOnly disabled />
                    <p className="text-xs text-muted-foreground">Este par só aceita destino do mesmo CPF — a conta é a mesma da origem.</p>
                  </>
                ) : (
                  <SearchSelect value={form.conta_recebedora_id} onChange={(v) => set("conta_recebedora_id", v)} options={contasDestino}
                    placeholder={form.programa_estoque_recebedor_id ? "Conta de destino" : "Selecione o programa primeiro"}
                    emptyText="Nenhuma conta neste programa" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Qtde transferida *</Label>
              <NumericInput value={Number(form.qtde_transferida) || 0} onChange={(n) => set("qtde_transferida", n ? String(n) : "")} />
              <p className="text-xs text-muted-foreground">Total da transferência, incluindo o carrinho.</p>
            </div>
            <div className="grid gap-1"><Label>Bônus (%) *</Label>
              <NumericInput decimal value={Number(form.bonus_pct) || 0} onChange={(n) => set("bonus_pct", String(n))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Carrinho (%) *</Label>
              <NumericInput decimal value={Number(form.carrinho_pct) || 0} onChange={(n) => set("carrinho_pct", String(n))} />
            </div>
            <div className="grid gap-1"><Label>Milhas do carrinho</Label>
              <NumericInput value={milhasCarrinho} onChange={setCarrinhoPorMilhas} />
            </div>
            <div className="grid gap-1"><Label>Qtde recebida (destino)</Label><Input value={nf(recebida)} readOnly disabled /></div>
          </div>

          {form.programa_estoque_remetente_id && form.programa_estoque_recebedor_id ? (
            <div className={`rounded-md border px-3 py-2 text-sm ${!conversao ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "text-muted-foreground"}`}>
              {!conversao
                ? <>Sem conversão cadastrada de <strong>{nomeEstoque(form.programa_estoque_remetente_id)}</strong> para <strong>{nomeEstoque(form.programa_estoque_recebedor_id)}</strong> — a transferência está sendo tratada como 1:1. Cadastre em Configurações › Programas Estoque › aba Conversões.</>
                : <>Conversão: <strong>{fator.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong> ponto(s) de {nomeEstoque(form.programa_estoque_remetente_id)} por <strong>1</strong> de {nomeEstoque(form.programa_estoque_recebedor_id)} · troca de conta: <strong>{destinatarioLabel(conversao.destinatario)}</strong>.</>}
            </div>
          ) : null}

          {promocao?.bonus_maximo ? (
            <div className={`rounded-md border px-3 py-2 text-sm ${calcBonus.limitado ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "text-muted-foreground"}`}>
              Teto da promoção: {nf(promocao.bonus_maximo)} milhas de bônus por conta.
              Já bonificado nesta conta: {nf(jaBonificado)} · disponível: {nf(calcBonus.restante ?? 0)}.
              {calcBonus.limitado && " O excedente entra sem bônus."}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="text-destructive tabular-nums">-{nf(saiDoEstoque)}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="text-emerald-600 tabular-nums">+{nf(recebida)}</span>
            <span>
              {nf(Number(form.qtde_transferida) || 0)} transferidas
              {milhasCarrinho > 0 ? ` (${nf(milhasCarrinho)} do carrinho + ${nf(saiDoEstoque)} do estoque)` : ""}
              {fator !== 1 ? ` / ${fator.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} de conversão` : ""}
              {` + ${(Number(form.bonus_pct) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de bônus (${nf(calcBonus.bonus)}${calcBonus.limitado ? " — teto da promoção" : ""})`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-3">
            <div className="grid gap-1"><Label>Custo total (R$) *</Label>
              <NumericInput decimal prefix="R$" value={Number(form.custo_total) || 0}
                onChange={(n) => setForm((f) => ({ ...f, custo_total: String(n), valor_parcela: calcParcela(String(n), f.num_parcelas) }))} />
            </div>
            <div className="grid gap-1"><Label>Pagamento *</Label>
              <Select value={form.meio_pagamento} onValueChange={(v) => setForm((f) => ({ ...f, meio_pagamento: v, forma_pagamento: "", banco_id: "", num_parcelas: v === "pix" ? "" : f.num_parcelas }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ehPix ? (
              <div className="grid gap-1"><Label>Banco {Number(form.custo_total) > 0 ? "*" : ""}</Label>
                <SearchSelect value={form.banco_id} onChange={(v) => set("banco_id", v)} options={bancoOptions} placeholder="Selecione o banco" emptyText="Nenhum banco cadastrado" />
              </div>
            ) : (
              <div className="grid gap-1"><Label>Cartão {Number(form.custo_total) > 0 ? "*" : ""}</Label>
                <SearchSelect value={form.forma_pagamento} onChange={(v) => set("forma_pagamento", v)} options={cartaoOptions} placeholder="Selecione o cartão" emptyText="Nenhum cartão" />
              </div>
            )}
          </div>
          {!ehPix && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>Nº de parcelas *</Label><Input type="number" min={0} value={form.num_parcelas} onChange={(e) => setForm((f) => ({ ...f, num_parcelas: e.target.value, valor_parcela: calcParcela(f.custo_total, e.target.value) }))} /></div>
              <div className="grid gap-1"><Label>Valor parcela (R$)</Label>
                <NumericInput decimal prefix="R$" value={Number(form.valor_parcela) || 0} onChange={(n) => set("valor_parcela", String(n))} />
              </div>
            </div>
          )}
          {recebida > 0 && Number(form.custo_total) > 0 && (
            <p className="text-sm text-muted-foreground">
              Custo médio no destino: <strong>{brl(custoMilheiroDestino)}</strong> por milheiro de {nomeEstoque(form.programa_estoque_recebedor_id) || "destino"} ({brl(Number(form.custo_total) || 0)} ÷ {nf(recebida)} milhas).
            </p>
          )}
          <div className="grid gap-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex.: Transferência integral com bônus 35%" rows={2} /></div>
          <p className="text-xs text-muted-foreground">Ao salvar, o estoque da origem diminui em {nf(saiDoEstoque)} e o do destino aumenta em {nf(recebida)}.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={voltar}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
