import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Plane, Loader2 } from "lucide-react";

// Captcha (Cloudflare Turnstile): a Site key é pública (aparece no HTML), então fica
// embutida como padrão para valer no build de produção. Pode ser sobrescrita pelo .env.
// No backend, precisa estar ativo em Supabase → Auth → Attack Protection (provider Turnstile + secret).
// Para DESLIGAR o widget: troque o padrão por "" aqui (e desligue no Supabase).
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || "0x4AAAAAADvFJ2cHm-7enWZm";

declare global {
  interface Window { turnstile?: any }
}

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    const render = () => {
      if (window.turnstile && captchaRef.current && widgetId.current === null) {
        widgetId.current = window.turnstile.render(captchaRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setCaptchaToken(token),
          "expired-callback": () => setCaptchaToken(null),
        });
      }
    };
    if (window.turnstile) { render(); return; }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, []);

  // Registra a tentativa de login (sucesso ou falha) para monitoramento de acessos indevidos.
  const registrarTentativa = (sucesso: boolean) => {
    try {
      supabase.functions.invoke("registrar-login", { body: { email, sucesso } }).catch(() => {});
    } catch { /* monitoramento nunca bloqueia o login */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      toast.error("Confirme a verificação de segurança antes de entrar.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        ...(TURNSTILE_SITE_KEY && captchaToken ? { options: { captchaToken } } : {}),
      });
      if (error) throw error;
      if (data?.session) { registrarTentativa(true); toast.success("Login realizado com sucesso!"); }
    } catch (error: any) {
      registrarTentativa(false);
      // Log completo no console para diagnostico
      console.error("[LOGIN] erro:", error);
      const msg =
        error?.message ||
        error?.error_description ||
        error?.name ||
        (error?.status ? `HTTP ${error.status}` : null) ||
        "Falha de conexao com o servidor. Verifique a internet/credenciais.";
      toast.error(`Erro: ${msg}`);
      // Turnstile: token é de uso único — renova o desafio após falha.
      if (TURNSTILE_SITE_KEY && window.turnstile && widgetId.current !== null) {
        window.turnstile.reset(widgetId.current);
        setCaptchaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent via-background to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">DreamTickets</CardTitle>
          <CardDescription>Faça login para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {TURNSTILE_SITE_KEY && <div ref={captchaRef} className="flex justify-center" />}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Acesso restrito. Novos usuários são cadastrados pelo administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
