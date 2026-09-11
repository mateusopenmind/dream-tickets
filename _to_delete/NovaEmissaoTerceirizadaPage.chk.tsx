import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUpsertEmissaoTerceirizada, useClientes, useFornecedores, useProgramas, useOperacoes, useOrigens, useEmissores } from "@/hooks/useData";
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
import { vLocalizador, vCodigoLA, vMilhas, vNumPax, vDataVoo, dataVooMax } from "@/lib/validacoesEmissao";
import { ajusteVisivel, reaisDiferemDosCobrados, temAlgumAjuste } from "@/lib/ajustesEmissao";
import { TipoValorToggle } from "@/components/ui/tipo-valor-toggle";
import { ArrowLeft, Building2, Copy } from "lucide-react";

const emptyForm = {
  data_emissao: "",
  hora: "",
  localizador: "", programa: "", nome_operacao: "", emissor: "", data_voo_ida: "",
  fornecedor_id: "", cliente_id: "", passageiros_qtd: 1,
  milhas_cobrado: 0, preco_milheiro: 0, taxas_cobrado: 0, bagagens_cobrado: 0, assentos_cobrado: 0, outros_cobrado: 0, outros_descricao: "", preco_total: 0,
  taxas_tipo: "reais", bagagens_tipo: "reais", assentos_tipo: "reais",
  milhas_real: 0, custo_milheiro: 0, taxas_real: 0, bagagens_real: 0, assentos_real: 0, outros_real: 0,
  taxas_real_tipo: "reais", bagagens_real_tipo: "reais", assentos_real_tipo: "reais",
  ajuste_cupom: "", ajuste_hack_upgrade: false, ajuste_retarifacao: false, ajuste_taxa_resgate: false, ajuste_desconto_promo: false, ajuste_campo_aberto: "",
  codigo_la: "", origem_venda: "",
  observacao: "", nota: "",
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

function Linha({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{children}</div>;
}

export default function NovaEmissaoTerceirizadaPage() {
  const navigate = useNavigate();
  const upsert = useUpsertEmissaoTerceirizada();
  const { data: clientes } = useClientes();
  const { data: fornecedores } = useFornecedores();
  const { data: programas } = useProgramas();
  const { data: operacoes } = useOperacoes();
  const { data: origens } = useOrigens();
  const { data: emissores } = useEmissores();
  const [form, setForm] = useState(() => {
    const agora = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return {
      ...emptyForm,
      data_emissao: `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`,
      hora: `${p(agora.getHours())}:${p(agora.getMinutes())}`,
    };
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const valorTaxas = form.taxas_tipo === "milhas" ? form.taxas_cobrado * form.preco_milheiro / 1000 : form.taxas_cobrado;
  const valorBagagens = form.bagagens_tipo === "milhas" ? form.bagagens_cobrado * form.preco_milheiro / 1000 : form.bagagens_cobrado;
  const valorAssentos = form.assentos_tipo === "milhas" ? form.assentos_cobrado * form.preco_milheiro / 1000 : form.assentos_cobrado;
  const precoTotal = useMemo(
    () => Math.round((form.milhas_cobrado * form.preco_milheiro / 1000 + valorTaxas + valorBagagens + valorAssentos + form.outros_cobrado) * 100) / 100,
    [form.milhas_cobrado, form.preco_milheiro, valorTaxas, valorBagagens, valorAssentos, form.outros_cobrado]
  );

  // Custo Total: mesma lógica do Preço Total, mas do lado dos Valores Reais/Custo Milheiro (o que se paga ao fornecedor).
  const custoTaxas = form.taxas_real_tipo === "milhas" ? form.taxas_real * form.custo_milheiro / 1000 : form.taxas_real;
  const custoBagagens = form.bagagens_real_tipo === "milhas" ? form.bagagens_real * form.custo_milheiro / 1000 : form.bagagens_real;
  const custoAssentos = form.assentos_real_tipo === "milhas" ? form.assentos_real * form.custo_milheiro / 1000 : form.assentos_real;
  const custoTotal = useMemo(
    () => Math.round((form.milhas_real * form.custo_milheiro / 1000 + custoTaxas + custoBagagens + custoAssentos + form.outros_real) * 100) / 100,
    [form.milhas_real, form.custo_milheiro, custoTaxas, custoBagagens, custoAssentos, form.outros_real]
  );

  function validar(): string | null {
    if (!form.data_emissao) return "Informe a Data de Emissão.";
    if (!form.hora) return "Informe a Hora.";
    if (!form.localizador) return "Informe o Localizador.";
    if (!form.programa) return "Selecione o Programa.";
    if (!form.nome_operacao) return "Selecione o Nome da Operação.";
    if (!form.emissor) return "Selecione o Emissor.";
    if (!form.data_voo_ida) return "Informe a Data do Voo (Ida).";
    { const e = vDataVoo(form.data_voo_ida, form.data_emissao); if (e) return e; }
    if (!form.fornecedor_id) return "Selecione o Fornecedor.";
    if (!form.cliente_id) return "Selecione o Cliente.";
    if (!form.passageiros_qtd || form.passageiros_qtd < 1) return "Informe o Nº de Pax.";
    if (!form.origem_venda) return "Selecione a Origem.";
    if ((form.programa || "").toLowerCase() === "latam" && !form.codigo_la) return "Código LA é obrigatório para emissões Latam.";
    if (form.outros_cobrado > 0 && !form.outros_descricao.trim()) return "Descreva o que é a cobrança em 'Outros'.";
    if ([form.milhas_cobrado, form.preco_milheiro, form.taxas_cobrado, form.bagagens_cobrado, form.assentos_cobrado, form.outros_cobrado].some((v) => v != null && (isNaN(v) || v < 0)))
      return "Os Valores Cobrados não podem ser negativos.";
    if ([form.milhas_real, form.taxas_real, form.bagagens_real, form.assentos_real, form.outros_real, form.custo_milheiro].some((v) => v == null || isNaN(v) || v < 0))
      return "Preencha os Valores Reais (Milhas, Custo Milheiro, Taxas, Bagagens, Assentos e Outros). Podem ser 0, mas não negativos.";
    if (reaisDiferemDosCobrados(form) && !temAlgumAjuste(form))
      return "Os Valores Reais diferem dos Cobrados — preencha ao menos um campo de Ajuste (Cupom, Hack Upgrade, Retarifação, Taxa de Resgate, Desconto Promocional ou Campo Aberto).";
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
        cliente_id: form.cliente_id || null, fornecedor_id: form.fornecedor_id || null,
        hora: form.hora || null, data_voo_ida: form.data_voo_ida || null,
        codigo_la: ehLatam ? (form.codigo_la || null) : null,
        outros_descricao: form.outros_cobrado > 0 ? (form.outros_descricao || null) : null,
        ajuste_cupom: diff && ajusteVisivel("cupom", form.programa) && form.ajuste_cupom ? (parseFloat(form.ajuste_cupom) || null) : null,
        ajuste_hack_upgrade: diff && ajusteVisivel("hack_upgrade", form.programa) ? !!form.ajuste_hack_upgrade : false,
        ajuste_retarifacao: diff && ajusteVisivel("retarifacao", form.programa) ? !!form.ajuste_retarifacao : false,
        ajuste_taxa_resgate: diff && ajusteVisivel("taxa_resgate", form.programa) ? !!form.ajuste_taxa_resgate : false,
        ajuste_desconto_promo: diff && ajusteVisivel("desconto_promo", form.programa) ? !!form.ajuste_desconto_promo : false,
        ajuste_campo_aberto: diff ? (form.ajuste_campo_aberto?.trim() || null) : null,
      });
      toast.success("Emissão terceirizada criada!");
      navigate("/emissoes-terceirizadas", (criada as any)?.id ? { state: { cobrarEmissao: criada } } : undefined);
    } catch (err: any) {
      console.error("[EMISSAO TERCEIRIZADA] erro ao salvar:", err);
      toast.error(`Erro ao salvar: ${err?.message || err?.details || "Erro desconhecido."}`);
    } finally { setSalvando(false); }
  };

  const ehLatam = (form.programa || "").toLowerCase() === "latam";

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/emissoes-terceirizadas")}><ArrowLeft className="h-5 w-5" /></Button>
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Nova Emissão Terceirizada</h1>
          <span className="text-sm font-mono font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">ID gerado ao salvar</span>
          <AjudaButton chave="nova_emissao_terceirizada" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/emissoes-terceirizadas")}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar Emissão"}</Button>
        </div>
      </div>

      <Secao titulo="Dados da Emissão">
        <div className="grid gap-1"><Label>Data Emissão *</Label><Input type="date" value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} /></div>
        <div className="grid gap-1"><Label>Hora *</Label><Input type="time" value={form.hora} onChange={(e) => set("hora", e.target.value)} /></div>
        <div className="grid gap-1"><Label>Localizador *</Label><Input value={form.localizador} onChange={(e) => set("localizador", e.target.value.toUpperCase().slice(0, 13))} placeholder="ABC123" className={vLocalizador(form.localizador) ? "border-destructive" : ""} /><CampoErro msg={vLocalizador(form.localizador)} /></div>
        <div className="grid gap-1"><Label>Programa *</Label><SearchSelect value={form.programa} onChange={(v) => set("programa", v)} options={(programas ?? []).filter((p: any) => (p as any).usar_nas_emissoes !== false).map((p) => ({ value: p.nome, label: p.nome }))} /></div>
        <div className="grid gap-1"><Label>Nome Operação *</Label><SearchSelect value={form.nome_operacao} onChange={(v) => set("nome_operacao", v)} options={(operacoes ?? []).map((o) => ({ value: o.nome, label: o.nome }))} /></div>
        <div className="grid gap-1"><Label>Data Voo Ida *</Label><Input type="date" max={dataVooMax()} value={form.data_voo_ida} onChange={(e) => set("data_voo_ida", e.target.value)} className={vDataVoo(form.data_voo_ida, form.data_emissao) ? "border-destructive" : ""} /><CampoErro msg={vDataVoo(form.data_voo_ida, form.data_emissao)} /></div>
        {/* Emissão terceirizada: sem Conta — usa Fornecedor no lugar. Emissor mantido. */}
        <div className="grid gap-1"><Label>Emissor *</Label><SearchSelect value={form.emissor} onChange={(v) => set("emissor", v)} options={(emissores ?? []).map((e) => ({ value: e.nome, label: e.nome }))} /></div>
        <div className="grid gap-1"><Label>Fornecedor *</Label><SearchSelect value={form.fornecedor_id} onChange={(v) => set("fornecedor_id", v)} options={[...(fornecedores ?? [])].filter((f: any) => f.ativo !== false).sort((a: any, b: any) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR")).map((f: any) => ({ value: f.id, label: f.codigo ? `${f.codigo} - ${f.nome}` : f.nome }))} /></div>
        <div className="grid gap-1 col-span-2"><Label>Cliente *</Label><SearchSelect value={form.cliente_id} onChange={(v) => set("cliente_id", v)} options={[...(clientes ?? [])].sort((a, b) => (a.codigo ?? "").localeCompare(b.codigo ?? "", "pt-BR", { numeric: true })).map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome_fantasia || c.razao_social || ""}` }))} /></div>
        <div className="grid gap-1"><Label>Nº Pax *</Label><Input type="number" min={1} value={form.passageiros_qtd} onChange={(e) => set("passageiros_qtd", parseInt(e.target.value) || 0)} className={vNumPax(form.passageiros_qtd) ? "border-destructive" : ""} /><CampoErro msg={vNumPax(form.passageiros_qtd)} /></div>
        <div className="grid gap-1"><Label>Origem *</Label><SearchSelect value={form.origem_venda} onChange={(v) => set("origem_venda", v)} options={(origens ?? []).map((o) => ({ value: o.nome, label: o.nome }))} /></div>
        {/* Latam: apenas Código LA (sem % Cashback / Pagar facial nesta tela) */}
        {ehLatam && (
          <div className="grid gap-1"><Label>Código LA *</Label><Input value={form.codigo_la} onChange={(e) => set("codigo_la", e.target.value.toUpperCase())} placeholder="LA123" className={vCodigoLA(form.codigo_la, form.programa) ? "border-destructive" : ""} /><CampoErro msg={vCodigoLA(form.codigo_la, form.programa)} /></div>
        )}
      </Secao>

      <Secao titulo="Valores Cobrados" plain>
        <Linha>
          <div className="grid gap-1"><Label>Qtde Milhas *</Label><NumericInput value={form.milhas_cobrado} onChange={(n) => set("milhas_cobrado", n)} placeholder="0" error={!!vMilhas(form.milhas_cobrado)} /><CampoErro msg={vMilhas(form.milhas_cobrado)} /></div>
          <div className="grid gap-1"><Label>Preço Milheiro *</Label><NumericInput value={form.preco_milheiro} onChange={(n) => set("preco_milheiro", n)} decimal prefix="R$" placeholder="0,00" /></div>
        </Linha>
        <Linha>
          <div className="grid gap-1">
            <div className="flex items-center justify-between"><Label>Taxas</Label><TipoValorToggle value={form.taxas_tipo} onChange={(t) => set("taxas_tipo", t)} /></div>
            <NumericInput value={form.taxas_cobrado} onChange={(n) => set("taxas_cobrado", n)} decimal={form.taxas_tipo === "reais"} prefix={form.taxas_tipo === "reais" ? "R$" : undefined} placeholder={form.taxas_tipo === "reais" ? "0,00" : "0"} />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between"><Label>Bagagens</Label><TipoValorToggle value={form.bagagens_tipo} onChange={(t) => set("bagagens_tipo", t)} /></div>
            <NumericInput value={form.bagagens_cobrado} onChange={(n) => set("bagagens_cobrado", n)} decimal={form.bagagens_tipo === "reais"} prefix={form.bagagens_tipo === "reais" ? "R$" : undefined} placeholder={form.bagagens_tipo === "reais" ? "0,00" : "0"} />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between"><Label>Assentos</Label><TipoValorToggle value={form.assentos_tipo} onChange={(t) => set("assentos_tipo", t)} /></div>
            <NumericInput value={form.assentos_cobrado} onChange={(n) => set("assentos_cobrado", n)} decimal={form.assentos_tipo === "reais"} prefix={form.assentos_tipo === "reais" ? "R$" : undefined} placeholder={form.assentos_tipo === "reais" ? "0,00" : "0"} />
          </div>
          <div className="grid gap-1"><Label>Outros</Label><NumericInput value={form.outros_cobrado} onChange={(n) => set("outros_cobrado", n)} decimal prefix="R$" placeholder="0,00" /></div>
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

      {/* Valores Reais = custo pago ao Fornecedor */}
      <Secao titulo="Valores Reais" plain>
        <div className="-mb-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, milhas_real: f.milhas_cobrado, taxas_real: f.taxas_cobrado, taxas_real_tipo: f.taxas_tipo, bagagens_real: f.bagagens_cobrado, bagagens_real_tipo: f.bagagens_tipo, assentos_real: f.assentos_cobrado, assentos_real_tipo: f.assentos_tipo, outros_real: f.outros_cobrado }))}>
            <Copy className="h-3.5 w-3.5 mr-1" />Copiar dos Valores Cobrados
          </Button>
        </div>
        {/* Qtde Milhas e Custo Milheiro sempre na primeira linha */}
        <Linha>
          <div className="grid gap-1"><Label>Qtde Milhas *</Label><NumericInput value={form.milhas_real} onChange={(n) => set("milhas_real", n)} placeholder="0" error={!!vMilhas(form.milhas_real)} /><CampoErro msg={vMilhas(form.milhas_real)} /></div>
          <div className="grid gap-1"><Label>Custo Milheiro *</Label><NumericInput value={form.custo_milheiro} onChange={(n) => set("custo_milheiro", n)} decimal prefix="R$" placeholder="0,00" /></div>
        </Linha>
        <Linha>
          <div className="grid gap-1">
            <div className="flex items-center justify-between"><Label>Taxas *</Label><TipoValorToggle value={form.taxas_real_tipo} onChange={(t) => set("taxas_real_tipo", t)} /></div>
            <NumericInput value={form.taxas_real} onChange={(n) => set("taxas_real", n)} decimal={form.taxas_real_tipo === "reais"} prefix={form.taxas_real_tipo === "reais" ? "R$" : undefined} placeholder={form.taxas_real_tipo === "reais" ? "0,00" : "0"} />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between"><Label>Bagagens</Label><TipoValorToggle value={form.bagagens_real_tipo} onChange={(t) => set("bagagens_real_tipo", t)} /></div>
            <NumericInput value={form.bagagens_real} onChange={(n) => set("bagagens_real", n)} decimal={form.bagagens_real_tipo === "reais"} prefix={form.bagagens_real_tipo === "reais" ? "R$" : undefined} placeholder={form.bagagens_real_tipo === "reais" ? "0,00" : "0"} />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between"><Label>Assentos</Label><TipoValorToggle value={form.assentos_real_tipo} onChange={(t) => set("assentos_real_tipo", t)} /></div>
            <NumericInput value={form.assentos_real} onChange={(n) => set("assentos_real", n)} decimal={form.assentos_real_tipo === "reais"} prefix={form.assentos_real_tipo === "reais" ? "R$" : undefined} placeholder={form.assentos_real_tipo === "reais" ? "0,00" : "0"} />
          </div>
          <div className="grid gap-1"><Label>Outros *</Label><NumericInput value={form.outros_real} onChange={(n) => set("outros_real", n)} decimal prefix="R$" placeholder="0,00" /></div>
        </Linha>
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
        {/* Custo Total no lugar do Cartão Utilizado — calculado automaticamente igual o Preço Total */}
        <Linha>
          <div className="grid gap-1"><Label>Custo Total</Label><Input readOnly disabled value={custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} className="bg-muted font-semibold text-right" /></div>
        </Linha>
      </Secao>

      {reaisDiferemDosCobrados(form) && (
        <Secao titulo="Ajustes (Valores Reais ≠ Cobrados)">
          <p className="col-span-2 md:col-span-4 -mt-1 text-xs text-muted-foreground">
            Os valores reais diferem dos cobrados. Preencha ao menos um campo abaixo para justificar a diferença.
          </p>
          {ajusteVisivel("cupom", form.programa) && (
            <div className="grid gap-1"><Label>Cupom (%)</Label><NumericInput value={Number(form.ajuste_cupom) || 0} onChange={(n) => set("ajuste_cupom", String(n))} decimal placeholder="0,00" /></div>
          )}
          {ajusteVisivel("hack_upgrade", form.programa) && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_hack_upgrade} onChange={(e) => setForm((f) => ({ ...f, ajuste_hack_upgrade: e.target.checked }))} /><span className="text-sm">Hack Upgrade</span></label>
          )}
          {ajusteVisivel("retarifacao", form.programa) && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_retarifacao} onChange={(e) => setForm((f) => ({ ...f, ajuste_retarifacao: e.target.checked }))} /><span className="text-sm">Retarifação</span></label>
          )}
          {ajusteVisivel("taxa_resgate", form.programa) && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_taxa_resgate} onChange={(e) => setForm((f) => ({ ...f, ajuste_taxa_resgate: e.target.checked }))} /><span className="text-sm">Taxa de Resgate</span></label>
          )}
          {ajusteVisivel("desconto_promo", form.programa) && (
            <label className="flex items-center gap-2 h-10 px-3 rounded-md border cursor-pointer select-none mt-6"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={!!form.ajuste_desconto_promo} onChange={(e) => setForm((f) => ({ ...f, ajuste_desconto_promo: e.target.checked }))} /><span className="text-sm">Desconto Promocional</span></label>
          )}
          <div className="grid gap-1 col-span-2 md:col-span-4"><Label>Campo Aberto</Label><Textarea value={form.ajuste_campo_aberto} onChange={(e) => set("ajuste_campo_aberto", e.target.value)} rows={2} placeholder="Descreva o motivo da diferença..." /></div>
        </Secao>
      )}

      <Secao>
        <div className="grid gap-1 col-span-2 md:col-span-4"><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => set("observacao", e.target.value)} rows={2} placeholder="Observações adicionais..." /></div>
      </Secao>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => navigate("/emissoes-terceirizadas")}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar Emissão"}</Button>
      </div>
    </div>
  );
}
