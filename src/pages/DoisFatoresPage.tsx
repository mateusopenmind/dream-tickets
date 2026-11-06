import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { ShieldCheck, Loader2, Copy } from "lucide-react";
import { ISSUER_2FA, srcDoQr } from "@/lib/doisFatores";

/**
 * Segunda etapa do login (obrigatória — ver lib/doisFatores.ts).
 * - Usuário que ainda não tem autenticador: mostra o QR Code para cadastrar e pede o
 *   primeiro código para confirmar.
 * - Usuário que já tem: pede o código de 6 dígitos.
 * Ao confirmar, o Supabase troca a sessão para aal2 e o App.tsx libera o sistema sozinho
 * (evento MFA_CHALLENGE_VERIFIED no onAuthStateChange).
 */
export default function DoisFatoresPage() {
  const { user, signOut } = useAuth();
  const [modo, setModo] = useState<"carregando" | "cadastrar" | "verificar" | "erro">("carregando");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string>("");
  const [segredo, setSegredo] = useState<string>("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroInicial, setErroInicial] = useState("");
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return; // StrictMode monta duas vezes — não cadastrar dois fatores
    iniciou.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verificado = (data?.totp ?? []).find((f) => f.status === "verified");
        if (verificado) {
          setFactorId(verificado.id);
          setModo("verificar");
          return;
        }
        // Cadastro começado e não concluído (fechou a aba no meio): descarta e recomeça.
        for (const f of data?.all ?? []) {
          if (f.factor_type === "totp" && f.status !== "verified") {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
        const { data: novo, error: eErr } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: ISSUER_2FA,
          friendlyName: `${ISSUER_2FA} ${new Date().toISOString().slice(0, 19)}`,
        });
        if (eErr) throw eErr;
        setFactorId(novo.id);
        setQr(srcDoQr(novo.totp?.qr_code));
        setSegredo(novo.totp?.secret ?? "");
        setModo("cadastrar");
      } catch (e: any) {
        console.error("[2FA] erro ao iniciar:", e);
        setErroInicial(e?.message || "Não foi possível iniciar a verificação em duas etapas.");
        setModo("erro");
      }
    })();
  }, []);

  const confirmar = async (e?: FormEvent) => {
    e?.preventDefault();
    const limpo = codigo.replace(/\D/g, "");
    if (limpo.length !== 6) { toast.error("Digite os 6 números que aparecem no app autenticador."); return; }
    if (!factorId) return;
    setEnviando(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: limpo });
      if (error) throw error;
      toast.success(modo === "cadastrar" ? "Autenticador cadastrado! A partir de agora o código será pedido a cada login." : "Código confirmado.");
      // O App.tsx percebe a sessão aal2 e abre o sistema.
    } catch (err: any) {
      console.error("[2FA] código recusado:", err);
      toast.error("Código inválido ou expirado. Confira a hora do celular e use o código que está aparecendo agora.");
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  };

  const copiarSegredo = async () => {
    try { await navigator.clipboard.writeText(segredo); toast.success("Chave copiada."); } catch { /* */ }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent via-background to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verificação em duas etapas</CardTitle>
          <CardDescription>
            {modo === "cadastrar"
              ? "Obrigatória para todos os usuários. Cadastre o DreamTickets no app autenticador do seu celular."
              : modo === "verificar"
                ? "Abra o app autenticador no celular e digite o código do DreamTickets."
                : user?.email ?? ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modo === "carregando" && (
            <div className="py-8 text-center"><Loader2 className="inline h-6 w-6 animate-spin text-primary" /></div>
          )}

          {modo === "erro" && (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">{erroInicial}</p>
              <p className="text-muted-foreground">Saia e entre de novo. Se continuar, fale com o administrador.</p>
            </div>
          )}

          {modo === "cadastrar" && (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Instale no celular o <b>Google Authenticator</b> ou o <b>Microsoft Authenticator</b> (grátis na Play Store / App Store).</li>
              <li>No app, toque em <b>+</b> e em <b>Ler código QR</b>, e aponte para o código abaixo.</li>
              <li>Digite aqui os 6 números que aparecerem para <b>DreamTickets</b>.</li>
            </ol>
          )}

          {modo === "cadastrar" && qr && (
            <div className="flex flex-col items-center gap-2">
              <img src={qr} alt="QR Code do autenticador" className="h-48 w-48 rounded-md border bg-white p-2" />
              {segredo && (
                <div className="w-full text-center text-xs text-muted-foreground">
                  Não consegue ler o QR? Escolha <b>Inserir chave de configuração</b> no app e digite:
                  <button type="button" onClick={copiarSegredo} className="mt-1 flex w-full items-center justify-center gap-1 rounded border bg-muted px-2 py-1 font-mono text-[11px] text-foreground break-all" title="Copiar">
                    {segredo} <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </div>
              )}
            </div>
          )}

          {(modo === "cadastrar" || modo === "verificar") && (
            <form onSubmit={confirmar} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="codigo2fa">Código de 6 dígitos</Label>
                <Input
                  id="codigo2fa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={7}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.4em] font-mono"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ""))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {modo === "cadastrar" ? "Confirmar e entrar" : "Entrar"}
              </Button>
            </form>
          )}

          {modo === "verificar" && (
            <p className="text-center text-xs text-muted-foreground">
              Trocou ou perdeu o celular? Peça ao administrador para zerar a sua verificação em duas etapas.
            </p>
          )}

          <button type="button" onClick={signOut} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">Sair</button>
        </CardContent>
      </Card>
    </div>
  );
}
