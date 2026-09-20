// Comprovante de pagamento Pix desenhado em canvas e baixado como PNG.
//
// Por que imagem e nao texto: o comprovante quase sempre termina no WhatsApp do parceiro,
// e imagem cola inteira, nao perde formatacao e nao da para editar sem parecer editada.
//
// O que NAO entra: nada de uso interno. No facial, o parceiro recebe pela CONTA dele —
// quais emissoes geraram aquele valor e assunto nosso, nao dele. Por isso a lista de
// emissoes fica fora do comprovante do facial (fica no extrato do lote, que e interno).

export interface DadosComprovante {
  tipo: "facial" | "fornecedor" | "reembolso" | string;
  valor: number;
  favorecido: string | null;
  documento: string | null;
  chavePix: string | null;
  descricao: string | null;
  referencia: string | null;
  localizador: string | null;
  idTransacao: string | null;
  pagoEm: string | null;
  qtdEmissoes?: number;
}

const brl = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataHora = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Mascara parcial do CPF/CNPJ: confirma quem recebeu sem espalhar o documento inteiro.
function mascararDoc(d: string | null): string | null {
  if (!d) return null;
  const n = d.replace(/\D/g, "");
  if (n.length === 11) return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`;
  if (n.length === 14) return `**.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-**`;
  return d;
}

export function baixarComprovantePix(d: DadosComprovante) {
  const ehFacial = d.tipo === "facial";

  // Linhas do corpo. No facial, sem referencia/localizador (informacao interna).
  const linhas: Array<[string, string]> = [];
  linhas.push(["Favorecido", d.favorecido || "—"]);
  const doc = mascararDoc(d.documento);
  if (doc) linhas.push(["CPF/CNPJ", doc]);
  if (d.chavePix) linhas.push(["Chave Pix", d.chavePix]);
  if (!ehFacial) {
    if (d.referencia) linhas.push(["Referência", d.referencia]);
    if (d.localizador) linhas.push(["Localizador", d.localizador]);
  }
  if (d.descricao) linhas.push(["Descrição", d.descricao]);
  linhas.push(["Data do pagamento", dataHora(d.pagoEm)]);
  if (d.idTransacao) linhas.push(["ID da transação", d.idTransacao]);

  const escala = 2;                       // nitidez em tela cheia e no celular
  const L = 760;
  const margem = 48;
  const topo = 132;                       // faixa do cabecalho
  const alturaValor = 118;
  const alturaLinha = 54;
  const A = topo + alturaValor + linhas.length * alturaLinha + 118;

  const canvas = document.createElement("canvas");
  canvas.width = L * escala;
  canvas.height = A * escala;
  const c = canvas.getContext("2d");
  if (!c) return;
  c.scale(escala, escala);

  // Fundo
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, L, A);

  // Cabecalho
  c.fillStyle = "#0f172a";
  c.fillRect(0, 0, L, topo);
  c.fillStyle = "#ffffff";
  c.font = "600 26px system-ui, -apple-system, Segoe UI, Arial";
  c.fillText("Comprovante de pagamento Pix", margem, 58);
  c.fillStyle = "#94a3b8";
  c.font = "400 16px system-ui, -apple-system, Segoe UI, Arial";
  c.fillText("DreamTickets", margem, 88);

  // Valor em destaque: e a primeira coisa que qualquer um procura
  let y = topo + 52;
  c.fillStyle = "#64748b";
  c.font = "400 14px system-ui, -apple-system, Segoe UI, Arial";
  c.fillText("VALOR PAGO", margem, y);
  y += 42;
  c.fillStyle = "#0f172a";
  c.font = "700 40px system-ui, -apple-system, Segoe UI, Arial";
  c.fillText(brl(d.valor), margem, y);

  y = topo + alturaValor + 24;
  c.strokeStyle = "#e2e8f0";
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(margem, y); c.lineTo(L - margem, y); c.stroke();
  y += 12;

  // Corpo
  for (const [rotulo, valor] of linhas) {
    y += alturaLinha;
    c.fillStyle = "#64748b";
    c.font = "400 14px system-ui, -apple-system, Segoe UI, Arial";
    c.fillText(rotulo, margem, y - 20);

    c.fillStyle = "#0f172a";
    const mono = rotulo === "ID da transação" || rotulo === "Chave Pix";
    c.font = mono
      ? "400 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      : "500 17px system-ui, -apple-system, Segoe UI, Arial";

    // Texto longo (chave, id) encolhe ate caber, em vez de vazar da imagem
    let txt = valor;
    const largMax = L - margem * 2;
    let tam = mono ? 15 : 17;
    while (c.measureText(txt).width > largMax && tam > 10) {
      tam -= 1;
      c.font = mono
        ? `400 ${tam}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
        : `500 ${tam}px system-ui, -apple-system, Segoe UI, Arial`;
    }
    c.fillText(txt, margem, y);

    c.strokeStyle = "#f1f5f9";
    c.beginPath(); c.moveTo(margem, y + 16); c.lineTo(L - margem, y + 16); c.stroke();
  }

  // Rodape
  y += 56;
  c.fillStyle = "#94a3b8";
  c.font = "400 13px system-ui, -apple-system, Segoe UI, Arial";
  c.fillText("Pagamento efetuado via Pix. Confira em seu extrato bancário.", margem, y);

  const nome = [
    "comprovante-pix",
    (ehFacial ? d.descricao : (d.localizador || d.referencia)) || "pagamento",
    new Date().toISOString().slice(0, 10),
  ].join("-").replace(/[^A-Za-z0-9-]/g, "").toLowerCase();

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Solta a memoria do blob depois que o navegador pegou o arquivo.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}
