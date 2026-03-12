import { useState, useEffect, useMemo } from "react";
import { useUpsertEmissao, useClientes, useContas, useCartoes } from "@/hooks/useData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PROGRAMAS, OPERACOES, EMISSORES, ORIGENS_VENDA, STATUS_PIX } from "@/lib/constants";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any;
}

const emptyForm = {
  data_emissao: new Date().toISOString().split("T")[0],
  hora: "",
  localizador: "",
  programa: "",
  nome_operacao: "",
  emissor: "",
  origem_venda: "",
  cliente_id: "",
  conta_id: "",
  cartao_id: "",
  passageiros_qtd: 1,
  milhas_cobrado: 0,
  preco_milheiro: 0,
  taxas_cobrado: 0,
  outros_cobrado: 0,
  preco_total: 0,
  status_pix: "EM ABERTO",
  valor_recebido: 0,
  observacao: "",
  txid: "",
  reprocessar: false,
};

export function EmissaoFormDialog({ open, onOpenChange, editing }: Props) {
  const upsert = useUpsertEmissao();
  const { data: clientes } = useClientes();
  const { data: contas } = useContas();
  const { data: cartoes } = useCartoes();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
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
        passageiros_qtd: editing.passageiros_qtd ?? 1,
        milhas_cobrado: editing.milhas_cobrado ?? 0,
        preco_milheiro: editing.preco_milheiro ?? 0,
        taxas_cobrado: editing.taxas_cobrado ?? 0,
        outros_cobrado: editing.outros_cobrado ?? 0,
        preco_total: editing.preco_total ?? 0,
        status_pix: editing.status_pix || "EM ABERTO",
        valor_recebido: editing.valor_recebido ?? 0,
        observacao: editing.observacao || "",
        txid: editing.txid || "",
        reprocessar: editing.reprocessar ?? false,
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing, open]);

  // Auto-calc preço total
  const precoTotal = useMemo(() => {
    return (form.milhas_cobrado * form.preco_milheiro) + form.taxas_cobrado + form.outros_cobrado;
  }, [form.milhas_cobrado, form.preco_milheiro, form.taxas_cobrado, form.outros_cobrado]);

  const setField = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));
  const setNumField = (key: string, value: string) => setForm(f => ({ ...f, [key]: parseFloat(value) || 0 }));

  const isValid = form.localizador && form.data_emissao && form.cliente_id && form.conta_id && form.milhas_cobrado > 0 && form.preco_milheiro > 0;

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        ...form,
        preco_total: precoTotal,
        id: editing?.id,
        cliente_id: form.cliente_id || null,
        conta_id: form.conta_id || null,
        cartao_id: form.cartao_id || null,
        hora: form.hora || null,
      });
      toast.success(editing ? "Emissão atualizada!" : "Emissão criada!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar emissão");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar" : "Nova"} Emissão</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* Row 1 */}
            <div className="grid gap-2">
              <Label>Data Emissão *</Label>
              <Input type="date" value={form.data_emissao} onChange={e => setField("data_emissao", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={e => setField("hora", e.target.value)} />
            </div>

            {/* Row 2 */}
            <div className="grid gap-2">
              <Label>Localizador *</Label>
              <Input value={form.localizador} onChange={e => setField("localizador", e.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" maxLength={6} />
            </div>
            <div className="grid gap-2">
              <Label>Programa</Label>
              <Select value={form.programa} onValueChange={v => setField("programa", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{PROGRAMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Row 3 */}
            <div className="grid gap-2">
              <Label>Operação</Label>
              <Select value={form.nome_operacao} onValueChange={v => setField("nome_operacao", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{OPERACOES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Emissor</Label>
              <Select value={form.emissor} onValueChange={v => setField("emissor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{EMISSORES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Row 4 */}
            <div className="grid gap-2">
              <Label>Origem da Venda</Label>
              <Select value={form.origem_venda} onValueChange={v => setField("origem_venda", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{ORIGENS_VENDA.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cliente *</Label>
              <Select value={form.cliente_id} onValueChange={v => setField("cliente_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clientes?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome_fantasia}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Row 5 */}
            <div className="grid gap-2">
              <Label>Conta *</Label>
              <Select value={form.conta_id} onValueChange={v => setField("conta_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{contas?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cartão</Label>
              <Select value={form.cartao_id} onValueChange={v => setField("cartao_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{cartoes?.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Row 6 - Numbers */}
            <div className="grid gap-2">
              <Label>Passageiros</Label>
              <Input type="number" min={1} value={form.passageiros_qtd} onChange={e => setNumField("passageiros_qtd", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Milhas Cobradas *</Label>
              <Input type="number" min={0} step="0.01" value={form.milhas_cobrado} onChange={e => setNumField("milhas_cobrado", e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Preço Milheiro *</Label>
              <Input type="number" min={0} step="0.01" value={form.preco_milheiro} onChange={e => setNumField("preco_milheiro", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Taxas Cobradas</Label>
              <Input type="number" min={0} step="0.01" value={form.taxas_cobrado} onChange={e => setNumField("taxas_cobrado", e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Outros Cobrados</Label>
              <Input type="number" min={0} step="0.01" value={form.outros_cobrado} onChange={e => setNumField("outros_cobrado", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Preço Total (calculado)</Label>
              <Input type="text" readOnly value={precoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} className="bg-muted font-mono font-semibold" />
            </div>

            {/* Row - Pix */}
            <div className="grid gap-2">
              <Label>Status Pix</Label>
              <Select value={form.status_pix} onValueChange={v => setField("status_pix", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_PIX.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valor Recebido</Label>
              <Input type="number" min={0} step="0.01" value={form.valor_recebido} onChange={e => setNumField("valor_recebido", e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>TXID (Pix)</Label>
              <Input value={form.txid} onChange={e => setField("txid", e.target.value)} placeholder="ID da transação" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.reprocessar} onCheckedChange={v => setField("reprocessar", v)} />
              <Label>Reprocessar</Label>
            </div>

            {/* Observação full width */}
            <div className="col-span-2 grid gap-2">
              <Label>Observação</Label>
              <Textarea value={form.observacao} onChange={e => setField("observacao", e.target.value)} rows={3} placeholder="Observações adicionais..." />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isValid}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
