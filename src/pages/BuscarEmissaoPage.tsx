import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil } from "@/hooks/usePerfil";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AjudaButton } from "@/components/AjudaButton";
import { EmissaoFormDialog } from "@/components/EmissaoFormDialog";
import { EmissaoTerceirizadaFormDialog } from "@/components/EmissaoTerceirizadaFormDialog";
import { Search, Loader2, Plane, Building2, Pencil, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Resultado {
  tabela_origem: "emissoes" | "emissoes_terceirizadas";
  id: string;
  id_emissao: string | null;
  localizador: string | null;
  programa: string | null;
  nome_operacao: string | null;
  emissor: string | null;
  data_emissao: string | null;
  hora: string | null;
  data_voo_ida: string | null;
  passageiros_qtd: number | null;
  cliente_codigo: string | null;
  cliente_nome: string | null;
  conta_codigo: string | null;
  conta_nome: string | null;
  cartao_codigo: string | null;
  cartao_nome: string | null;
  fornecedor_codigo: string | null;
  fornecedor_nome: string | null;
  milhas_cobrado: number | null;
  total_milhas: number | null;
  preco_milheiro: number | null;
  taxas_cobrado: number | null;
  taxas_tipo: string | null;
  bagagens_cobrado: number | null;
  bagagens_tipo: string | null;
  assentos_cobrado: number | null;
  assentos_tipo: string | null;
  outros_cobrado: number | null;
  outros_descricao: string | null;
  preco_total: number | null;
  status_pix: string | null;
  forma_cobranca: string | null;
  forma_paga: string | null;
  valor_recebido: number | null;
  data_recebimento: string | null;
  facial: boolean | null;
  observacao: string | null;
  owner_id: string | null;
  owner_nome: string | null;
}

const brl = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dataBR = (d: string | null) =>
  d ? format(new Date(d + "T00:00:00"), "dd/MM/yyyy") : "—";

// Valor de taxas/bagagens/assentos: pode estar em milhas ou reais, conforme o *_tipo.
const valorTipo = (v: number | null, tipo: string | null) =>
  tipo === "milhas" ? `${num(v)} milhas` : brl(v);

const statusVariant = (s: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "PAGO") return "default";
  if (s === "CANCELADO") return "destructive";
  return "secondary"; // EM ABERTO / demais
};

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{children ?? "—"}</span>
    </div>
  );
}

export default function BuscarEmissaoPage() {
  const { user } = useAuth();
  const { data: perfil } = usePerfil();
  const isAdmin = perfil?.papel === "super_admin" || perfil?.papel === "admin";

  const [termo, setTermo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const [editNormal, setEditNormal] = useState<any>(null);
  const [openNormal, setOpenNormal] = useState(false);
  const [editTerc, setEditTerc] = useState<any>(null);
  const [openTerc, setOpenTerc] = useState(false);
  const [carregandoEdicao, setCarregandoEdicao] = useState<string | null>(null);

  const buscar = async () => {
    const q = termo.trim();
    if (!q) return;
    setBuscando(true);
    try {
      const { data, error } = await (supabase as any).rpc("buscar_emissoes", { termo: q });
      if (error) throw error;
      setResultados((data ?? []) as Resultado[]);
      setBuscou(true);
    } catch (e: any) {
      toast.error("Erro ao buscar emissões: " + (e?.message ?? e));
    } finally {
      setBuscando(false);
    }
  };

  const podeEditar = (r: Resultado) => isAdmin || (!!user && r.owner_id === user.id);

  const abrirEdicao = async (r: Resultado) => {
    setCarregandoEdicao(r.id);
    try {
      if (r.tabela_origem === "emissoes") {
        const { data, error } = await supabase
          .from("emissoes")
          .select("*, clientes(codigo,nome_fantasia), contas(codigo,nome), cartoes(codigo,nome)")
          .eq("id", r.id)
          .single();
        if (error) throw error;
        setEditNormal(data);
        setOpenNormal(true);
      } else {
        const { data, error } = await supabase
          .from("emissoes_terceirizadas")
          .select("*, clientes(codigo,nome_fantasia), fornecedores(codigo,nome)")
          .eq("id", r.id)
          .single();
        if (error) throw error;
        setEditTerc(data);
        setOpenTerc(true);
      }
    } catch (e: any) {
      toast.error("Não foi possível abrir para edição: " + (e?.message ?? e));
    } finally {
      setCarregandoEdicao(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <h1 className="text-2xl font-display font-bold">Buscar Emissão</h1>
        <AjudaButton chave="buscar_emissao" />
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Localizador, ID da emissão ou cliente (código/nome)
          </label>
          <div className="flex gap-2">
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              placeholder="Ex.: ABC123, BR000061 ou A553"
              className="max-w-md"
              autoFocus
            />
            <Button onClick={buscar} disabled={buscando || !termo.trim()}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Buscar</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Consulta apenas leitura. Traz emissões próprias, de outros usuários e terceirizadas.
          </p>
        </div>
      </Card>

      {buscando ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin inline" />
        </div>
      ) : buscou && resultados.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          Nenhuma emissão encontrada para “{termo.trim()}”.
        </div>
      ) : (
        <div className="space-y-4">
          {resultados.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {resultados.length} emissão(ões) encontrada(s).
            </p>
          )}
          {resultados.map((r) => (
            <Card key={`${r.tabela_origem}-${r.id}`} className="p-4 space-y-3">
              {/* Cabeçalho */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {r.tabela_origem === "emissoes" ? (
                    <Plane className="h-4 w-4 text-primary" />
                  ) : (
                    <Building2 className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-mono font-semibold">{r.id_emissao || "—"}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold">🔖 {r.localizador || "—"}</span>
                  <Badge variant={statusVariant(r.status_pix)}>{r.status_pix || "—"}</Badge>
                  <Badge variant="outline">
                    {r.tabela_origem === "emissoes" ? "Própria" : "Terceirizada"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> {r.owner_nome || "—"}
                  </span>
                  {podeEditar(r) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEdicao(r)}
                      disabled={carregandoEdicao === r.id}
                    >
                      {carregandoEdicao === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                      <span className="ml-2">Editar</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Dados */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                <Campo label="Cliente">
                  {r.cliente_codigo || r.cliente_nome
                    ? `${r.cliente_codigo ?? ""}${r.cliente_codigo && r.cliente_nome ? " — " : ""}${r.cliente_nome ?? ""}`
                    : "—"}
                </Campo>
                <Campo label="Programa">{r.programa || "—"}</Campo>
                <Campo label="Operação">{r.nome_operacao || "—"}</Campo>
                <Campo label="Emissor">{r.emissor || "—"}</Campo>
                <Campo label="Data emissão">{dataBR(r.data_emissao)}</Campo>
                <Campo label="Hora">{r.hora ? String(r.hora).slice(0, 5) : "—"}</Campo>
                <Campo label="Data voo (ida)">{dataBR(r.data_voo_ida)}</Campo>
                <Campo label="Passageiros">{r.passageiros_qtd ?? "—"}</Campo>

                {r.tabela_origem === "emissoes" ? (
                  <>
                    <Campo label="Conta">
                      {r.conta_codigo || r.conta_nome
                        ? `${r.conta_codigo ?? ""}${r.conta_codigo && r.conta_nome ? " — " : ""}${r.conta_nome ?? ""}`
                        : "—"}
                    </Campo>
                    <Campo label="Cartão">
                      {r.cartao_codigo || r.cartao_nome
                        ? `${r.cartao_codigo ?? ""}${r.cartao_codigo && r.cartao_nome ? " — " : ""}${r.cartao_nome ?? ""}`
                        : "—"}
                    </Campo>
                    <Campo label="Facial">{r.facial ? "Sim" : "Não"}</Campo>
                  </>
                ) : (
                  <Campo label="Fornecedor">
                    {r.fornecedor_codigo || r.fornecedor_nome
                      ? `${r.fornecedor_codigo ?? ""}${r.fornecedor_codigo && r.fornecedor_nome ? " — " : ""}${r.fornecedor_nome ?? ""}`
                      : "—"}
                  </Campo>
                )}

                <Campo label="Milhas cobrado">{num(r.milhas_cobrado)}</Campo>
                <Campo label="Total de milhas">{num(r.total_milhas)}</Campo>
                <Campo label="Preço milheiro">{brl(r.preco_milheiro)}</Campo>
                <Campo label="Taxas">{valorTipo(r.taxas_cobrado, r.taxas_tipo)}</Campo>
                <Campo label="Bagagens">{valorTipo(r.bagagens_cobrado, r.bagagens_tipo)}</Campo>
                <Campo label="Assentos">{valorTipo(r.assentos_cobrado, r.assentos_tipo)}</Campo>
                <Campo label={r.outros_descricao ? `Outros (${r.outros_descricao})` : "Outros"}>
                  {brl(r.outros_cobrado)}
                </Campo>
                <Campo label="Preço total">
                  <span className="text-primary font-semibold">{brl(r.preco_total)}</span>
                </Campo>
                <Campo label="Valor recebido">{brl(r.valor_recebido)}</Campo>
                <Campo label="Forma de cobrança">{r.forma_cobranca || "—"}</Campo>
                <Campo label="Forma paga">{r.forma_paga || "—"}</Campo>
              </div>

              {r.observacao && (
                <div className="border-t pt-2">
                  <Campo label="Observação">{r.observacao}</Campo>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Diálogos de edição (só abertos por admin/dono) */}
      <EmissaoFormDialog open={openNormal} onOpenChange={setOpenNormal} editing={editNormal} />
      <EmissaoTerceirizadaFormDialog open={openTerc} onOpenChange={setOpenTerc} editing={editTerc} />
    </div>
  );
}
