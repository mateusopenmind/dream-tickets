import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { validarSenhaForte, SENHA_REGRA_TEXTO } from "@/lib/validacaoSenha";

export default function TrocarSenhaPage({ onConcluido }: { onConcluido?: () => void }) {
  const { signOut } = useAuth();
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const erroSenha = validarSenhaForte(nova);
    if (erroSenha) { toast.error(erroSenha); return; }
    if (nova !== conf) { toast.error("As senhas não conferem."); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { deve_trocar_senha: false }, password: nova });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      onConcluido?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao alterar a senha.");
    } finally { setSalvando(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent via-background to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Defina sua nova senha</CardTitle>
          <CardDescription>Por segurança, troque a senha temporária antes de continuar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Nova senha</Label><Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Senha forte" /><p className="text-xs text-muted-foreground">{SENHA_REGRA_TEXTO}</p></div>
          <div className="space-y-2"><Label>Confirmar nova senha</Label><Input type="password" value={conf} onChange={(e) => setConf(e.target.value)} /></div>
          <Button className="w-full" onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar nova senha</Button>
          <button type="button" onClick={signOut} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">Sair</button>
        </CardContent>
      </Card>
    </div>
  );
}
