import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEstoqueCompras, useSalvarCompra, useProgramasEstoque, custoMilheiro } from "@/hooks/useClubes";
import { useContas, useCartoes, useContaProgramas, useBancos } from "@/hooks/useData";
import { usePromocoes } from "@/hooks/usePromocoes";
import { vData } from "@/lib/validacoesData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rotuloConta } from "@/lib/rotuloConta";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
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
// Toda compra é a operação "Compra" — o campo saiu do formulário
const OPERACAO_COMPRA = "Compra";
const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const emptyForm = {
  data: isoHoje(), hora: "", conta_id: "", programa_estoque_id: "", qtde: "", custo_total: "",
  num_parcelas: "", meio_pagamento: "cartao", forma_pagamento: "", banco_id: "", valor_parcela: "", promocao_id: "", descricao: "",
};

export default function NovaCompraPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = !!id;

  const { data: compras } = useEstoqueCompras();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const { data: bancos } = useBancos();
  const { data: estoques } = useProgramasEstoque();
  const { data: contaProgramas } = useContaProgramas();
  const { data: promocoes } = usePromocoes();
  const salvar = useSalvarCompra();

  const [form, setForm] = useState(() => ({ ...emptyForm, hora: horaAgora() }));
  // Flag: a compra aguarda o crédito dos pontos (vai para a Conferência Compras) ou já entra creditada.
  // Padrão: desligada (a compra já sai confirmada); ligar só para compras que creditam depois.
  const [aguardarCredito, setAguardarCredito] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    const c = (compras ?? []).find((x: any) => x.id === id);
    if (!c) return;
    setForm({
      data: c.data ?? isoHoje(), hora: c.hora ?? "", conta_id: c.conta_id ?? "", programa_estoque_id: c.programa_estoque_id ?? "",
      qtde: c.qtde?.toString() ?? "", custo_total: c.custo_total?.toString() ?? "",
      num_parcelas: c.num_parcelas?.toString() ?? "", forma_pagamento: c.forma_pagamento ?? "",
      valor_parcela: c.valor_parcela?.toString() ?? "",
      meio_pagamento: c.meio_pagamento ?? "cartao", banco_id: c.banco_id ?? "",
      promocao_id: c.promocao_id ?? "", descricao: c.descricao ?? "",
    });
    setAguardarCredito(c.creditado === false);
  }, [editing, id, compras]);

  // Só as contas que participam do programa escolhido (mesma regra das Emissões)
  const contaOptions = useMemo(() => {
    const lista = (contas ?? []).slice()
      .filter((c: any) => !!form.programa_estoque_id && (contaProgramas?.[c.id]?.has(form.programa_estoque_id) ?? false))
      .sort((a: any, b: any) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true }))
      .map((c: any) => ({ value: c.id, label: rotuloConta(c), searchText: c.nome || "" }));
    // ao editar, a conta já gravada continua aparecendo mesmo que não participe mais do programa
    if (form.conta_id && !lista.some((o) => o.value === form.conta_id)) {
      const c = (contas ?? []).find((x: any) => x.id === form.conta_id);
      if (c) lista.unshift({ value: c.id, label: rotuloConta(c), searchText: c.nome || "" });
    }
    return lista;
  }, [contas, contaProgramas, form.programa_estoque_id, form.conta_id]);
  // Trocar o programa limpa a conta quando ela não participa do novo programa
  const setPrograma = (v: string) => setForm((f) => ({
    ...f,
    programa_estoque_id: v,
    conta_id: f.conta_id && (contaProgramas?.[f.conta_id]?.has(v) ?? false) ? f.conta_id : "",
  }));
  const cartaoOptions = useMemo(
    () => (cartoes ?? []).slice()
      .map((c: any) => ({ value: c.codigo || c.nome || "", label: c.codigo || c.nome || "" }))
      .filter((o: any) => o.value)
      .sort((a: any, b: any) => a.label.localeCompare(b.label, "pt-BR", { numeric: true })),
    [cartoes]
  );
  const estoqueOptions = useMemo(
    () => (estoques ?? []).filter((e: any) => e.ativo !== false).map((e: any) => ({ id: e.id, nome: e.nome })),
    [estoques]
  );

  // Promoções de compra vigentes na data do lançamento (a promoção vem antes do programa)
  const promocaoOptions = useMemo(() => {
    const lista = (promocoes ?? []).filter((p: any) => {
      if (p.tipo !== "compra" || p.ativo === false) return false;
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
  // Com promoção escolhida, o programa dela manda (promoção sem programa vale para todos)
  const setPromocao = (v: string) => setForm((f) => {
    const pid = v === "__none" ? "" : v;
    const p = (promocoes ?? []).find((x: any) => x.id === pid);
    if (p?.programa_estoque_id && p.programa_estoque_id !== f.programa_estoque_id) {
      return { ...f, promocao_id: pid, programa_estoque_id: p.programa_estoque_id, conta_id: "" };
    }
    return { ...f, promocao_id: pid };
  });
  // Pix: o banco vem do cadastro Configurações › Bancos
  const ehPix = form.meio_pagamento === "pix";
  const bancoOptions = useMemo(() => (bancos ?? []).map((b: any) => ({ value: b.id, label: b.nome })), [bancos]);

  const milheiro = useMemo(
    () => custoMilheiro(Number(form.custo_total) || 0, Number(form.qtde) || 0),
    [form.custo_total, form.qtde]
  );

  const voltar = () => navigate("/estoque-compras");

  const handleSave = async () => {
    // Todos os campos são obrigatórios (a Descrição é a única anotação livre)
    if (!form.data) { toast.error("Informe a data."); return; }
    const erroData = vData(form.data);
    if (erroData) { toast.error(erroData); return; }
    if (!form.hora) { toast.error("Informe a hora."); return; }
    if (!form.programa_estoque_id) { toast.error("Selecione o programa."); return; }
    if (!form.conta_id) { toast.error("Selecione a conta."); return; }
    if (!(Number(form.qtde) > 0)) { toast.error("Informe a quantidade de milhas."); return; }
    if (form.custo_total === "") { toast.error("Informe o custo total — use 0 se não houve custo."); return; }
    if (ehPix) {
      if (Number(form.custo_total) > 0 && !form.banco_id) { toast.error("Selecione o banco do Pix."); return; }
    } else {
      if (form.num_parcelas === "") { toast.error("Informe o número de parcelas."); return; }
      if (Number(form.custo_total) > 0 && !form.forma_pagamento) { toast.error("Selecione o cartão."); return; }
    }
    // Crédito: aguardando → Conferência Compras. Já creditada → entra no estoque na data/hora da compra.
    // Na edição de uma compra já creditada, o crédito só acompanha a nova data se antes era igual à da compra
    // (crédito automático); se foi confirmado com outra data na Conferência, fica como está.
    const atual = editing ? (compras ?? []).find((x: any) => x.id === id) : null;
    const horaCompra = form.hora ? `${form.hora.slice(0, 5)}:00` : null;
    let credito: { creditado: boolean; creditado_data: string | null; creditado_hora: string | null } | undefined;
    if (aguardarCredito) {
      credito = { creditado: false, creditado_data: null, creditado_hora: null };
    } else if (!atual || atual.creditado === false) {
      credito = { creditado: true, creditado_data: form.data, creditado_hora: horaCompra };
    } else {
      const automatico = !atual.creditado_data
        || (atual.creditado_data === atual.data && String(atual.creditado_hora ?? "").slice(0, 5) === String(atual.hora ?? "").slice(0, 5));
      credito = automatico ? { creditado: true, creditado_data: form.data, creditado_hora: horaCompra } : undefined;
    }
    try {
      await salvar.mutateAsync({
        id: editing ? id : undefined,
        credito,
        data: form.data, hora: form.hora || null, conta_id: form.conta_id, programa_estoque_id: form.programa_estoque_id,
        qtde: Number(form.qtde) || 0,
        custo_total: form.custo_total === "" ? null : Number(form.custo_total),
        num_parcelas: ehPix ? null : (form.num_parcelas === "" ? null : Number(form.num_parcelas)),
        meio_pagamento: form.meio_pagamento,
        banco_id: ehPix ? (form.banco_id || null) : null,
        forma_pagamento: ehPix ? null : (form.forma_pagamento || null),
        valor_parcela: form.valor_parcela === "" ? null : Number(form.valor_parcela),
        operacao: OPERACAO_COMPRA,
        promocao_id: form.promocao_id || null,
        descricao: form.descricao || null,
      });
      toast.success(editing ? "Compra atualizada!" : aguardarCredito ? "Compra lançada — aguardando o crédito na Conferência Compras." : "Compra lançada — somada ao estoque.");
      voltar();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao salvar compra"); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={voltar} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-display font-bold">{editing ? "Editar" : "Nova"} Compra</h1>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-md">
            <div className="grid gap-1"><Label>Data *</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="grid gap-1"><Label>Hora *</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
          </div>
          <div className="grid gap-1 sm:max-w-sm"><Label>Promoção</Label>
            <SearchSelect value={form.promocao_id || "__none"} onChange={setPromocao}
              options={promocaoOptions} placeholder="— sem promoção —" emptyText="Nenhuma promoção vigente nesta data" />
            {promocao?.programa_estoque_id && <p className="text-xs text-muted-foreground">Esta promoção vale só para o programa configurado nela.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1"><Label>Programa *</Label>
              <Select value={form.programa_estoque_id} onValueChange={setPrograma}>
                <SelectTrigger><SelectValue placeholder="Selecione o programa" /></SelectTrigger>
                <SelectContent>
                  {estoqueOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum programa cadastrado</div>
                  ) : estoqueOptions.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1"><Label>Conta *</Label>
              <SearchSelect value={form.conta_id} onChange={(v) => set("conta_id", v)} options={contaOptions}
                placeholder={form.programa_estoque_id ? "Selecione a conta" : "Selecione o programa primeiro"}
                emptyText="Nenhuma conta neste programa" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1"><Label>Qtde de milhas *</Label>
              <NumericInput value={Number(form.qtde) || 0} onChange={(n) => set("qtde", n ? String(n) : "")} />
            </div>
            <div className="grid gap-1"><Label>Custo total (R$) *</Label>
              <NumericInput decimal prefix="R$" value={Number(form.custo_total) || 0}
                onChange={(n) => setForm((f) => ({ ...f, custo_total: String(n), valor_parcela: calcParcela(String(n), f.num_parcelas) }))} />
            </div>
            <div className="grid gap-1"><Label>Custo milheiro</Label><Input value={milheiro ? brl(milheiro) : "—"} readOnly disabled /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <>
                <div className="grid gap-1"><Label>Nº de parcelas *</Label><Input type="number" min={0} value={form.num_parcelas} onChange={(e) => setForm((f) => ({ ...f, num_parcelas: e.target.value, valor_parcela: calcParcela(f.custo_total, e.target.value) }))} /></div>
                <div className="grid gap-1"><Label>Valor parcela (R$)</Label>
                  <NumericInput decimal prefix="R$" value={Number(form.valor_parcela) || 0} onChange={(n) => set("valor_parcela", String(n))} />
                </div>
              </>
            )}
          </div>
          {!ehPix && (
            <div className="grid gap-1 sm:max-w-sm"><Label>Cartão {Number(form.custo_total) > 0 ? "*" : ""}</Label>
              <SearchSelect value={form.forma_pagamento} onChange={(v) => set("forma_pagamento", v)} options={cartaoOptions} placeholder="Selecione o cartão" emptyText="Nenhum cartão" />
            </div>
          )}
          <div className="grid gap-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Anotações desta compra" rows={2} /></div>
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Switch id="aguardar-credito" checked={aguardarCredito} onCheckedChange={setAguardarCredito} className="mt-0.5" />
            <div className="grid gap-0.5">
              <Label htmlFor="aguardar-credito" className="cursor-pointer">Aguardar o crédito dos pontos (vai para a Conferência Compras)</Label>
              <p className="text-xs text-muted-foreground">
                {aguardarCredito
                  ? "Ligado: a compra fica em Estoque › Conferência Compras e só entra no estoque quando o crédito for confirmado, na data em que os pontos caírem."
                  : "Desligado: a compra já sai confirmada e entra no estoque na data/hora da compra."}
              </p>
            </div>
          </div>
          {(() => {
            // Situação atual do crédito (edição)
            const atual = editing ? (compras ?? []).find((x: any) => x.id === id) : null;
            if (aguardarCredito || !atual) return null;
            if (atual.creditado !== false) {
              const d = atual.creditado_data ?? atual.data;
              const h = atual.creditado_data ? atual.creditado_hora : atual.hora;
              return <p className="text-xs text-muted-foreground">Crédito confirmado em {d ? String(d).split("-").reverse().join("/") : "—"}{h ? ` ${String(h).slice(0, 5)}` : ""} — as milhas já estão no estoque da conta/programa.</p>;
            }
            return null;
          })()}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={voltar}>Cancelar</Button>
          <Button onClick={handleSave} disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </Card>
    </div>
  );
}
