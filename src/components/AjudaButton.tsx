import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SecaoAjudaView } from "@/components/AjudaConteudo";
import { ajudaPorChave, podeVerAjuda } from "@/lib/ajudaConteudo";
import { usePerfil, useMinhasTelas } from "@/hooks/usePerfil";

// Botão "?" que abre a ajuda contextual de uma tela.
export function AjudaButton({ chave }: { chave: string }) {
  const [open, setOpen] = useState(false);
  const { data: perfil } = usePerfil();
  const { data: minhasTelas } = useMinhasTelas();
  const secao = ajudaPorChave(chave);
  const isSuper = perfil?.papel === "super_admin";
  if (!secao || !podeVerAjuda(chave, minhasTelas, isSuper)) return null;

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Ajuda desta tela" aria-label="Ajuda">
        <HelpCircle className="h-5 w-5 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajuda — {secao.titulo}</DialogTitle>
          </DialogHeader>
          <SecaoAjudaView secao={secao} />
        </DialogContent>
      </Dialog>
    </>
  );
}
