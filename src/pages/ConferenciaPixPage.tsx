import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AjudaButton } from "@/components/AjudaButton";
import { baixarComprovantePix } from "@/lib/comprovantePix";
import { Loader2, ShieldCheck, RefreshCw, AlertTriangle, Copy, Ban, FileText, Send, Undo2, Trash2, Download, Smartphone, QrCode } from "lucide-react";
import { toast } from "sonner";
import { contar } from "@/lib/plural";

// Conferencia Pix — onde o lote e conferido e aprovado antes de qualquer dinheiro sair.
//
// A trava que importa nao e a senha: e a coluna "Titular (Banco Central)". Ela vem da
// consulta DICT feita na preparacao, e nao do nosso cadastro. Nome divergente = linha
// destacada. Linha sem chave cadastrada entra como BLOQUEADO e nao e paga.

const fmtReais = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Para onde o operador volta quando desiste do Pix automatico: a tela de onde o lote saiu,
// onde ele paga do jeito de sempre (no banco, e marcando como pago na mao).
const ROTA_ORIGEM: Record<string, string> = {
  facial: "/pagamento-facial",
  fornecedor: "/pagamento-fornecedores",
  reembolso: "/pagamento-reembolsos",
};

const ROTULO_TIPO: Record<string, string> = {
  facial: "Faciais",
  fornecedor: "Fornecedores",
  reembolso: "Reembolsos",
};

// Estados do item. INICIADO = chave ja resolvida no Banco Central, esperando aprovacao.
// CONFIRMADO = ja mandado ao banco, aguardando a confirmacao dele.
const ROTULO_ITEM: Record<string, string> = {
  PENDENTE: "A consultar",
  INICIADO: "Pronto p/ pagar",
  CONFIRMADO: "Enviado ao banco",
  FINALIZADO_SUCESSO: "Pago",
  FINALIZADO_REJEICAO: "Rejeitado",
  BLOQUEADO: "Sem chave no cadastro",
  ERRO_INICIACAO: "Chave recusada pelo banco",
  CANCELADO: "Cancelado",
};

// Itens que nao entram no pagamento — ficam fora do total e seguem manual.
const FORA = ["BLOQUEADO", "ERRO_INICIACAO", "CANCELADO"];

// Enquanto o lote esta em um destes, nada foi enviado ao banco e da para reverter.
const ABERTOS = ["PREPARANDO", "AGUARDANDO_CONFERENCIA", "AGUARDANDO_APROVACAO"];

const ROTULO_STATUS: Record<string, string> = {
  PREPARANDO: "Preparando",
  AGUARDANDO_CONFERENCIA: "Aguardando conferência",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  APROVADO: "Aprovado",
  EXECUTANDO: "Executando",
  CONCLUIDO: "Concluído",
  PARCIAL: "Parcial",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

interface Lote {
  id: string;
  tipo: string;
  status: string;
  qtd_itens: number;
  valor_total: number;
  exige_codigo: boolean;
  teto_aplicado: number | null;
  solicitado_em: string;
  erro: string | null;
}

interface Item {
  id: string;
  referencia: string | null;
  localizador: string | null;
  nome_cadastro: string | null;
  titular_esperado: string | null;
  titular_nome: string | null;
  titular_documento: string | null;
  divergencia_nome: boolean;
  chave_pix: string | null;
  valor: number;
  descricao: string | null;
  metodo: string;
  estado: string;
  erro: string | null;
  end_to_end_id: string | null;
  pago_em: string | null;
  grupo_chave: string | null;
  grupo_lider: boolean;
  valor_grupo: number | null;
}

// Um grupo = um Pix. No facial, varias emissoes da mesma conta viram um pagamento so.
interface Grupo {
  chave: string;
  lider: Item;
  itens: Item[];
  total: number;
}

export default function ConferenciaPixPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const loteSelecionado = params.get("lote");

  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [extrato, setExtrato] = useState<string | null>(null);
  const [confirmandoReverter, setConfirmandoReverter] = useState(false);
  // Nome diferente do cadastro e o unico jeito de perceber uma chave trocada antes do
  // dinheiro sair. Em 18/09/2026 um Pix de conta P106 caiu na conta de outra pessoa
  // porque a mesma chave estava em dois cadastros. Por isso o aceite agora e explicito.
  const [conferiDivergencia, setConferiDivergencia] = useState(false);
  // Terceira validacao: codigo de 6 digitos do Google Authenticator do aprovador.
  const [totp, setTotp] = useState("");
  const [cadastroTotp, setCadastroTotp] = useState<any>(null);   // { chave, uri, qr_svg }
  const [totpCadastro, setTotpCadastro] = useState("");

  const { data: lotes, isLoading: carregandoLotes } = useQuery({
    queryKey: ["pagamentos_lote"],
    queryFn: async (): Promise<Lote[]> => {
      const { data, error } = await supabase
        .from("pagamentos_lote")
        .select("id, tipo, status, qtd_itens, valor_total, exige_codigo, teto_aplicado, solicitado_em, erro")
        .order("solicitado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Lote[];
    },
    refetchInterval: 5000,
  });

  const lote = useMemo(
    () => (lotes ?? []).find((l) => l.id === loteSelecionado) ?? null,
    [lotes, loteSelecionado],
  );

  const { data: itens, isLoading: carregandoItens } = useQuery({
    queryKey: ["pagamentos_lote_itens", loteSelecionado],
    enabled: !!loteSelecionado,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("pagamentos_lote_itens")
        .select(
          "id, referencia, localizador, nome_cadastro, titular_esperado, titular_nome, titular_documento, divergencia_nome, chave_pix, valor, descricao, metodo, estado, erro, end_to_end_id, pago_em, grupo_chave, grupo_lider, valor_grupo",
        )
        .eq("lote_id", loteSelecionado)
        .order("estado")
        .order("referencia");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
    refetchInterval: 5000,
  });

  const pagaveis = (itens ?? []).filter((i) => !FORA.includes(i.estado));

  // Agrupa para a tela mostrar exatamente o que sera enviado: uma linha = um Pix.
  const grupos: Grupo[] = useMemo(() => {
    const mapa = new Map<string, Item[]>();
    for (const i of pagaveis) {
      const k = i.grupo_chave ?? i.id;
      mapa.set(k, [...(mapa.get(k) ?? []), i]);
    }
    return [...mapa.entries()].map(([chave, lista]) => {
      const lider = lista.find((x) => x.grupo_lider) ?? lista[0];
      return { chave, lider, itens: lista, total: lista.reduce((a, x) => a + (Number(x.valor) || 0), 0) };
    });
  }, [itens]);
  const bloqueados = (itens ?? []).filter((i) => FORA.includes(i.estado));
  const divergentes = pagaveis.filter((i) => i.divergencia_nome);
  const pagos = (itens ?? []).filter((i) => i.estado === "FINALIZADO_SUCESSO");
  const enviados = (itens ?? []).filter((i) => i.estado === "CONFIRMADO");
  const encerrado = !!lote && !ABERTOS.includes(lote.status);
  // Lote encerrado que nao pagou nada e sujeira: pode sumir da lista de vez.
  const podeDescartar = encerrado && pagos.length === 0 && enviados.length === 0;
  const semTitular = pagaveis.filter((i) => !i.titular_nome && i.metodo === "CHAVE");
  const total = pagaveis.reduce((a, i) => a + (Number(i.valor) || 0), 0);

  // O supabase-js troca qualquer resposta nao-2xx pela mensagem "Edge Function returned a
  // non-2xx status code" e joga o corpo dentro de error.context. Sem ler esse corpo, o
  // operador ve um erro de programador em vez do motivo real ("Senha incorreta", "Faltam
  // consultas de titular"...). Entao a primeira coisa a fazer com um erro e abrir o corpo.
  const lerErroDaFuncao = async (error: any): Promise<string> => {
    try {
      const resp = error?.context;
      if (resp && typeof resp.text === "function") {
        const txt = await resp.text();
        try {
          const j = JSON.parse(txt);
          if (j?.erro) return String(j.erro);
          if (j?.error) return String(j.error);
        } catch { /* nao era JSON */ }
        if (txt && txt.length < 300) return txt;
      }
    } catch { /* corpo ja consumido ou indisponivel */ }
    if (error?.message?.includes("non-2xx")) {
      return "O servidor recusou a operação e não explicou o motivo. Tente de novo; se repetir, me avise.";
    }
    if (error?.message?.includes("Failed to fetch")) {
      return "Não foi possível falar com o servidor. Verifique a internet e tente de novo.";
    }
    return error?.message ?? "Erro inesperado.";
  };

  const chamar = async (acao: string, extra: Record<string, unknown> = {}) => {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("pagamentos-pix", {
        body: { acao, lote_id: loteSelecionado, ...extra },
      });
      if (error) throw new Error(await lerErroDaFuncao(error));
      if ((data as any)?.erro) throw new Error((data as any).erro);
      return data as any;
    } finally {
      setEnviando(false);
    }
  };

  const consultarTitulares = async () => {
    try {
      await chamar("preparar");
      toast.success("Consulta iniciada. Os titulares vão aparecendo na lista.");
      qc.invalidateQueries({ queryKey: ["pagamentos_lote_itens", loteSelecionado] });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível consultar os titulares.");
    }
  };

  // Situacao do Google Authenticator do aprovador. Nao depende de lote nenhum.
  const { data: totpStatus } = useQuery({
    queryKey: ["pagamentos_totp_status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("pagamentos-pix", {
        body: { acao: "totp_status", lote_id: loteSelecionado || "sem-lote" },
      });
      if (error) throw new Error(await lerErroDaFuncao(error));
      return data as { cadastrado: boolean; pendente: boolean; pode_cadastrar: boolean };
    },
    staleTime: 60_000,
  });
  // O codigo do aplicativo e obrigatorio SEMPRE. Sem app cadastrado nenhum pagamento sai —
  // validacao que pode ser pulada por falta de cadastro nao e validacao.
  const totpCadastrado = !!totpStatus?.cadastrado;
  const faltaCadastrarTotp = !!totpStatus && !totpCadastrado;

  const gerarQrTotp = async () => {
    try {
      const r = await chamar("totp_iniciar");
      setCadastroTotp(r);
      setTotpCadastro("");
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível gerar o QR Code.");
    }
  };

  const confirmarTotp = async () => {
    try {
      await chamar("totp_confirmar", { totp: totpCadastro });
      setCadastroTotp(null); setTotpCadastro("");
      toast.success("Aplicativo cadastrado. A partir de agora o código dele é obrigatório para aprovar.");
      qc.invalidateQueries({ queryKey: ["pagamentos_totp_status"] });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível confirmar o código.");
    }
  };

  const pedirCodigo = async () => {
    try {
      const r = await chamar("enviar_codigo");
      toast.success(`Código enviado para ${r?.enviado_para ?? "o aprovador"}. Vale por 10 minutos.`);
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível enviar o código.");
    }
  };

  const aprovar = async () => {
    if (!senha) { toast.error("Digite sua senha do sistema."); return; }
    if (lote?.exige_codigo && !codigo) { toast.error("Peça e digite o código do aprovador para liberar o pagamento."); return; }
    if (divergentes.length > 0 && !conferiDivergencia) {
      toast.error("Confirme que conferiu as linhas com nome diferente do cadastro antes de aprovar.");
      return;
    }
    if (faltaCadastrarTotp) {
      toast.error("O Google Authenticator do aprovador ainda não foi cadastrado. Sem ele nenhum pagamento é liberado.", { duration: 12000, closeButton: true });
      return;
    }
    if (totp.replace(/\D/g, "").length !== 6) {
      toast.error("Digite os 6 dígitos do Google Authenticator.");
      return;
    }
    try {
      await chamar("aprovar", { senha, codigo: codigo || null, totp: totp || null });
      setSenha(""); setCodigo(""); setTotp(""); setConferiDivergencia(false);
      toast.success("Lote aprovado. Os pagamentos estão sendo enviados.");
      qc.invalidateQueries({ queryKey: ["pagamentos_lote"] });
    } catch (e: any) {
      // Erro de aprovacao fica na tela ate ser fechado: e a hora em que o operador mais
      // precisa ler o motivo com calma, e nao um toast que some em 4 segundos.
      toast.error(e.message ?? "Não foi possível aprovar o lote.", { duration: 12000, closeButton: true });
    }
  };

  // Reverter: desfaz o lote e devolve o operador para a tela de onde ele veio, para pagar
  // do jeito de sempre. Nada foi pago ate aqui — iniciacao sem confirmacao nao move dinheiro.
  const reverter = async () => {
    try {
      const r = await chamar("descartar");
      setConfirmandoReverter(false);
      qc.invalidateQueries({ queryKey: ["pagamentos_lote"] });
      if (encerrado) {
        toast.success("Lote descartado.");
        setParams({});
      } else {
        toast.success("Pagamento por Pix revertido. Os itens voltaram para a lista normal.");
        navigate(ROTA_ORIGEM[r?.tipo ?? lote?.tipo ?? ""] ?? "/conferencia-pix");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível reverter o lote.");
    }
  };

  const verExtrato = async (enviar: boolean) => {
    try {
      const r = await chamar("extrato", { enviar });
      setExtrato(r?.texto ?? "");
      if (enviar) {
        if (r?.enviado) toast.success("Extrato enviado no seu WhatsApp.");
        else toast.warning(r?.aviso ?? "Extrato pronto, mas não foi possível enviar.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível montar o extrato.");
    }
  };

  // Comprovante em imagem: e o formato que o operador encaminha no WhatsApp sem perder
  // formatacao. No facial o comprovante NAO leva as emissoes — o parceiro recebe pela
  // conta dele, quais emissoes geraram o valor e informacao interna (fica no extrato).
  const baixarComprovante = (g: Grupo) => {
    const i = g.lider;
    baixarComprovantePix({
      tipo: lote?.tipo ?? "",
      valor: g.total,
      favorecido: i.titular_nome ?? i.nome_cadastro,
      documento: i.titular_documento,
      chavePix: i.chave_pix,
      descricao: i.descricao,
      referencia: g.itens.map((x) => x.referencia).filter(Boolean).join(", ") || null,
      localizador: g.itens.map((x) => x.localizador).filter(Boolean).join(", ") || null,
      idTransacao: i.end_to_end_id,
      pagoEm: i.pago_em,
      qtdEmissoes: g.itens.length,
    });
    toast.success("Comprovante baixado.");
  };

  const podeAprovar =
    !!lote &&
    ["AGUARDANDO_CONFERENCIA", "AGUARDANDO_APROVACAO"].includes(lote.status) &&
    pagaveis.length > 0 &&
    semTitular.length === 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Conferência Pix <AjudaButton chave="conferencia_pix" />
        </h1>
        {loteSelecionado && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => verExtrato(false)} disabled={enviando}>
              <FileText className="h-4 w-4 mr-1" />Extrato do lote
            </Button>
            {lote && ABERTOS.includes(lote.status) && (
              <Button variant="destructive" size="sm" onClick={() => setConfirmandoReverter(true)} disabled={enviando}>
                <Undo2 className="h-4 w-4 mr-1" />Reverter
              </Button>
            )}
            {podeDescartar && (
              <Button variant="destructive" size="sm" onClick={() => setConfirmandoReverter(true)} disabled={enviando}>
                <Trash2 className="h-4 w-4 mr-1" />Descartar lote
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setParams({})}>Ver todos os lotes</Button>
          </div>
        )}
      </div>

      {!loteSelecionado && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Solicitado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {carregandoLotes && (
                <TableRow><TableCell colSpan={6} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
              )}
              {!carregandoLotes && (lotes ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhum lote. Os lotes são criados nas telas de Pagamentos, no botão "Pagar por Pix".
                </TableCell></TableRow>
              )}
              {(lotes ?? []).map((l) => (
                <TableRow key={l.id} className="cursor-pointer" onClick={() => setParams({ lote: l.id })}>
                  <TableCell className="py-2">{new Date(l.solicitado_em).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="py-2">{ROTULO_TIPO[l.tipo] ?? l.tipo}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{l.qtd_itens}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{fmtReais(l.valor_total)}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={l.status === "CONCLUIDO" ? "default" : l.status === "CANCELADO" || l.status === "EXPIRADO" ? "secondary" : "outline"}>
                      {ROTULO_STATUS[l.status] ?? l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Button variant="ghost" size="sm">Abrir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {loteSelecionado && lote && (
        <>
          <div className="flex flex-wrap gap-3">
            <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Tipo</div><div className="text-xl font-bold">{ROTULO_TIPO[lote.tipo] ?? lote.tipo}</div></Card>
            <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">A pagar</div><div className="text-xl font-bold">{pagaveis.length}</div></Card>
            <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-bold">{fmtReais(total)}</div></Card>
            <Card className="px-4 py-3"><div className="text-xs text-muted-foreground">Situação</div><div className="text-xl font-bold">{ROTULO_STATUS[lote.status] ?? lote.status}</div></Card>
          </div>

          {semTitular.length > 0 && (
            <Card className="p-4 flex items-start gap-3">
              <RefreshCw className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Falta consultar o titular de {contar(semTitular.length, "linha", "linhas")}</div>
                <div className="text-sm text-muted-foreground">
                  A consulta ao Banco Central é feita uma por segundo. Enquanto não terminar, o lote não pode ser aprovado.
                </div>
              </div>
              <Button size="sm" onClick={consultarTitulares} disabled={enviando}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar titulares"}
              </Button>
            </Card>
          )}

          {podeDescartar && (
            <Card className="p-4 flex items-start gap-3 border-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
              <div className="flex-1">
                <div className="font-medium">Nenhum pagamento foi feito neste lote</div>
                <div className="text-sm text-muted-foreground">
                  O banco recusou tudo, então nenhum dinheiro saiu e as {contar(pagaveis.length, "linha", "linhas")}
                  continuam pendentes na tela de origem. Veja o motivo na coluna "Situação": se for
                  algo de cadastro, corrija e monte um lote novo; se não for, pague no banco do jeito
                  de sempre. Este lote não serve para mais nada — pode descartar.
                </div>
              </div>
            </Card>
          )}

          {divergentes.length > 0 && (
            <Card className="p-4 flex items-start gap-3 border-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
              <div>
                <div className="font-medium text-destructive">
                  {contar(divergentes.length, "linha", "linhas")} com nome diferente do cadastro
                </div>
                <div className="text-sm text-muted-foreground">
                  O nome que o Banco Central devolveu não bate com o do cadastro. Confira antes de aprovar — pode ser chave trocada.
                </div>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Titular (Banco Central)</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {carregandoItens && (
                  <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
                )}
                {grupos.map((g) => {
                  const i = g.lider;
                  const varias = g.itens.length > 1;
                  return (
                    <TableRow key={g.chave} className={g.itens.some((x) => x.divergencia_nome) ? "bg-destructive/10" : undefined}>
                      <TableCell className="py-2 font-mono text-xs">
                        {g.itens.map((x) => (
                          <div key={x.id}>
                            {x.referencia ?? "—"}
                            {x.localizador && <span className="text-muted-foreground"> · {x.localizador}</span>}
                          </div>
                        ))}
                        {varias && (
                          <div className="mt-1 font-sans text-xs text-muted-foreground">
                            {g.itens.length} emissões num Pix só
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div>{i.nome_cadastro ?? "—"}</div>
                        {i.titular_esperado && (
                          <div className="text-xs text-muted-foreground">chave em nome de {i.titular_esperado}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {i.metodo === "DEVOLUCAO" ? (
                          <span className="text-muted-foreground">Volta para quem pagou</span>
                        ) : i.titular_nome ? (
                          <div>
                            <div className={i.divergencia_nome ? "font-medium text-destructive" : ""}>{i.titular_nome}</div>
                            {i.titular_documento && <div className="text-xs text-muted-foreground">{i.titular_documento}</div>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">aguardando consulta…</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline">{i.metodo === "DEVOLUCAO" ? "Devolução" : "Chave Pix"}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums">
                        {fmtReais(g.total)}
                        {varias && <div className="text-xs text-muted-foreground">{g.itens.length} × {fmtReais(i.valor)}</div>}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm">{ROTULO_ITEM[i.estado] ?? i.estado}</span>
                        {i.erro && <div className="text-xs text-destructive">{i.erro}</div>}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {i.estado === "FINALIZADO_SUCESSO" && (
                          <Button variant="ghost" size="sm" onClick={() => baixarComprovante(g)}>
                            <Download className="h-4 w-4 mr-1" />Comprovante
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {bloqueados.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Ban className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Não serão pagos ({bloqueados.length})</span>
                <span className="text-sm text-muted-foreground">— seguem pelo caminho manual</span>
              </div>
              <Table>
                <TableBody>
                  {bloqueados.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="py-2 font-mono text-xs">{i.referencia ?? "—"}</TableCell>
                      <TableCell className="py-2">{i.nome_cadastro ?? "—"}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{fmtReais(i.valor)}</TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground">{i.erro}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Cadastro do Google Authenticator do aprovador — terceira validacao.
              So admin enxerga o QR: se um operador pudesse ler, apontaria o app para o
              proprio celular e a validacao nao valeria nada. */}
          {faltaCadastrarTotp && (
            <Card className="p-4 flex flex-col gap-3 border-destructive">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
                <div>
                  <div className="font-medium text-destructive">
                    Nenhum pagamento sai enquanto o Google Authenticator não for cadastrado
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Aprovar exige três coisas: a sua senha, o código enviado ao aprovador por e-mail e os 6 dígitos
                    do aplicativo no celular dele.{" "}
                    {totpStatus?.pode_cadastrar
                      ? "Cadastre o aplicativo abaixo — leva um minuto."
                      : "Peça ao administrador para cadastrar o aplicativo aqui nesta tela."}
                  </div>
                </div>
              </div>

              {totpStatus.pode_cadastrar && !cadastroTotp && (
                <div>
                  <Button type="button" variant="outline" onClick={gerarQrTotp} disabled={enviando}>
                    <QrCode className="h-4 w-4 mr-2" /> Gerar QR Code
                  </Button>
                </div>
              )}

              {cadastroTotp && (
                <div className="grid gap-3 sm:grid-cols-[auto,1fr] sm:items-start">
                  {cadastroTotp.qr_svg ? (
                    <div className="rounded-md bg-white p-2 w-[200px]"
                         dangerouslySetInnerHTML={{ __html: cadastroTotp.qr_svg }} />
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Não foi possível desenhar o QR Code. Use a chave abaixo, na opção “Inserir chave de configuração” do aplicativo.
                    </div>
                  )}
                  <div className="grid gap-2">
                    <ol className="text-sm text-muted-foreground list-decimal ml-4 space-y-0.5">
                      <li>Abra o Google Authenticator no celular do aprovador.</li>
                      <li>Toque em + e leia o QR Code ao lado.</li>
                      <li>Digite abaixo os 6 dígitos que aparecerem e confirme.</li>
                    </ol>
                    <div className="grid gap-1">
                      <Label className="text-xs">Chave, para digitar à mão se o QR não for lido</Label>
                      <div className="flex gap-2">
                        <Input readOnly value={cadastroTotp.chave} className="font-mono text-xs" />
                        <Button type="button" variant="outline" size="icon" title="Copiar"
                                onClick={() => { navigator.clipboard?.writeText(cadastroTotp.chave); toast.success("Copiado!"); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="grid gap-1">
                        <Label htmlFor="totp-cadastro">Código do aplicativo</Label>
                        <Input id="totp-cadastro" inputMode="numeric" maxLength={6} placeholder="6 dígitos"
                               value={totpCadastro}
                               onChange={(e) => setTotpCadastro(e.target.value.replace(/\D/g, ""))} />
                      </div>
                      <Button type="button" onClick={confirmarTotp} disabled={enviando || totpCadastro.length !== 6}>
                        Confirmar e ativar
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setCadastroTotp(null); setTotpCadastro(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {totpStatus?.cadastrado && totpStatus.pode_cadastrar && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              Google Authenticator ativo.
              {cadastroTotp ? null : (
                <button type="button" className="underline" onClick={gerarQrTotp} disabled={enviando}>
                  Trocar de aparelho
                </button>
              )}
            </div>
          )}

          {totpStatus?.cadastrado && cadastroTotp && (
            <Card className="p-4 grid gap-3 sm:grid-cols-[auto,1fr] sm:items-start border-warning">
              {cadastroTotp.qr_svg ? (
                <div className="rounded-md bg-white p-2 w-[200px]"
                     dangerouslySetInnerHTML={{ __html: cadastroTotp.qr_svg }} />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Não foi possível desenhar o QR Code. Use a chave abaixo no aplicativo.
                </div>
              )}
              <div className="grid gap-2">
                <div className="text-sm">
                  Leia o QR no aparelho novo e confirme com os 6 dígitos. <strong>O aparelho antigo continua
                  valendo até você confirmar</strong> — se desistir, nada muda.
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={cadastroTotp.chave} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" title="Copiar"
                          onClick={() => { navigator.clipboard?.writeText(cadastroTotp.chave); toast.success("Copiado!"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="grid gap-1">
                    <Label htmlFor="totp-troca">Código do aplicativo novo</Label>
                    <Input id="totp-troca" inputMode="numeric" maxLength={6} placeholder="6 dígitos"
                           value={totpCadastro}
                           onChange={(e) => setTotpCadastro(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <Button type="button" onClick={confirmarTotp} disabled={enviando || totpCadastro.length !== 6}>
                    Confirmar troca
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setCadastroTotp(null); setTotpCadastro(""); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {podeAprovar && (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-medium">Aprovar o pagamento de {fmtReais(total)}</span>
              </div>
              {lote.exige_codigo ? (
                <p className="text-sm text-muted-foreground">
                  {Number(lote.teto_aplicado ?? 0) > 0
                    ? `Este lote passa do teto de ${fmtReais(Number(lote.teto_aplicado))}: além da sua senha, o código enviado ao aprovador e os 6 dígitos do aplicativo dele.`
                    : "Todo pagamento precisa das três: a sua senha, o código enviado ao aprovador e os 6 dígitos do aplicativo dele."}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Abaixo do teto de {fmtReais(Number(lote.teto_aplicado ?? 0))}: a sua senha do sistema e os 6 dígitos
                  do aplicativo do aprovador.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="senha-aprovacao">Sua senha do sistema</Label>
                  <Input id="senha-aprovacao" type="password" value={senha} autoComplete="current-password"
                         onChange={(e) => setSenha(e.target.value)} />
                </div>
                {lote.exige_codigo && (
                  <div className="grid gap-1">
                    <Label htmlFor="codigo-aprovacao">Código do aprovador</Label>
                    <div className="flex gap-2">
                      <Input id="codigo-aprovacao" inputMode="numeric" maxLength={6} value={codigo}
                             onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
                      <Button type="button" variant="outline" onClick={pedirCodigo} disabled={enviando}>Enviar código</Button>
                    </div>
                  </div>
                )}
                {(
                  <div className="grid gap-1">
                    <Label htmlFor="totp-aprovacao" className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5" /> Código do Google Authenticator
                    </Label>
                    <Input id="totp-aprovacao" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                           placeholder="6 dígitos" value={totp}
                           onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} />
                    <p className="text-xs text-muted-foreground">Os 6 dígitos que estão no aplicativo agora. Trocam a cada 30 segundos.</p>
                  </div>
                )}
              </div>
              {divergentes.length > 0 && (
                <label className="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
                    checked={conferiDivergencia}
                    onChange={(e) => setConferiDivergencia(e.target.checked)}
                  />
                  <span>
                    Conferi {contar(divergentes.length, "linha", "linhas")} em que o titular do Banco Central
                    não bate com o cadastro, e confirmo que o dinheiro deve ir para esse titular.
                  </span>
                </label>
              )}
              <div className="flex gap-2">
                <Button onClick={aprovar}
                        disabled={enviando || faltaCadastrarTotp || (divergentes.length > 0 && !conferiDivergencia)}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Aprovar e pagar
                </Button>
              </div>
            </Card>
          )}

          {lote.erro && (
            <Card className="p-4 text-sm text-destructive">{lote.erro}</Card>
          )}
        </>
      )}

      <Dialog open={confirmandoReverter} onOpenChange={(o) => { if (!enviando) setConfirmandoReverter(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{encerrado ? "Descartar este lote?" : "Desistir do pagamento por Pix?"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>Nada foi pago.</strong> Nenhum dinheiro saiu deste lote{encerrado ? " — o banco recusou tudo." : " — até aqui o sistema só perguntou ao Banco Central quem é o dono de cada chave."}</p>
            <p>
              O lote some da lista, e {contar(pagaveis.length, "item", "itens")} no valor de {fmtReais(total)}{" "}
              {encerrado ? "seguem" : "voltam a ficar"} pendentes na tela de{" "}
              {(ROTULO_TIPO[lote?.tipo ?? ""] ?? "Pagamentos").toLowerCase()}, para pagar do jeito
              de sempre ou tentar por Pix de novo.
            </p>
            <p className="text-muted-foreground">
              Lote que chegou a pagar alguma coisa nunca é apagado — esse fica no histórico.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmandoReverter(false)} disabled={enviando}>
              Continuar aqui
            </Button>
            <Button variant="destructive" onClick={reverter} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : encerrado ? <Trash2 className="h-4 w-4 mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
              {encerrado ? "Descartar" : "Reverter e voltar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={extrato !== null} onOpenChange={(o) => { if (!o) setExtrato(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Extrato do lote</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Resumo de tudo que entrou neste lote — pago, em andamento, rejeitado e o que ficou de
            fora. É de uso interno: vai para o operador, não para o fornecedor nem para o cliente.
          </p>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
            {extrato}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(extrato ?? ""); toast.success("Extrato copiado."); }}>
              <Copy className="h-4 w-4 mr-2" />Copiar
            </Button>
            <Button onClick={() => verExtrato(true)} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar no meu WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
