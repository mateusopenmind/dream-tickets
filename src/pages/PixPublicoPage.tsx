import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Copy, Check } from "lucide-react";
import NotFound from "./NotFound";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface PixData {
  id_emissao: string | null;
  localizador: string | null;
  programa: string | null;
  operacao: string | null;
  valor: number | null;
  status: string | null;
  pix_copia_cola: string | null;
  cliente: string | null;
  error?: string;
}

export default function PixPublicoPage() {
  const { id } = useParams();
  const [data, setData] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/pix-publico?id=${encodeURIComponent(id || "")}`);
        const j = await r.json();
        setData(j);
      } catch {
        setData({ error: "Não foi possível carregar a cobrança." } as PixData);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const copiar = async () => {
    if (!data?.pix_copia_cola) return;
    try {
      await navigator.clipboard.writeText(data.pix_copia_cola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* fallback: usuário seleciona manualmente */
    }
  };

  const fmt = (v: number | null) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Cobrança inexistente, paga, cancelada ou com a chave antiga vencida: a página tem que
  // ser INDISTINGUÍVEL de uma URL que nunca existiu. Um card dizendo "cobrança não
  // disponível" já entrega que /pix/<algo> é um endereço real e que aquela chave acertou
  // alguma coisa. Por isso reaproveitamos o mesmo 404 de qualquer rota inválida do app —
  // tem que ser o MESMO componente, não uma cópia parecida.
  if (!data || data.error || !data.pix_copia_cola) return <NotFound />;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(data.pix_copia_cola)}`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-slate-800">Pagamento via Pix</h1>
          <p className="text-sm text-slate-500">DreamTickets</p>
        </div>

        {/* Não existe mais o estado "Pagamento confirmado" aqui: assim que a cobrança é paga
            ou cancelada, a edge function passa a responder 404 e a página vira o 404 do app.
            Se um dia voltar a existir uma tela de "pago", ela precisa vir junto com a
            mudança correspondente na função — senão nunca é alcançada. */}
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-slate-900">{fmt(data.valor)}</div>
          <div className="text-xs text-slate-500 mt-1">
            {data.localizador} · {data.programa} · {data.operacao}
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <img src={qrUrl} alt="QR Code Pix" width={240} height={240} className="rounded-lg border" />
        </div>

        <p className="text-center text-sm text-slate-600 mb-2">
          Escaneie o QR Code ou use o Pix copia e cola:
        </p>

        <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs break-all font-mono mb-3 max-h-28 overflow-y-auto">
          {data.pix_copia_cola}
        </div>

        <button
          onClick={copiar}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-3 flex items-center justify-center gap-2 transition-colors"
        >
          {copiado ? (<><Check className="h-5 w-5" /> Copiado!</>) : (<><Copy className="h-5 w-5" /> Copiar código Pix</>)}
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          Após copiar, abra o app do seu banco, escolha Pix &gt; Copia e Cola e finalize o pagamento.
        </p>
      </div>
    </div>
  );
}
