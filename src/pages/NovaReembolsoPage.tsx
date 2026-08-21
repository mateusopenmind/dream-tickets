import { useNavigate } from "react-router-dom";
import { ReembolsoFormDialog } from "@/components/ReembolsoFormDialog";

// Tela cheia de Novo Reembolso (mesmo formato das emissões — rota própria, sem popup).
export default function NovaReembolsoPage() {
  const navigate = useNavigate();
  return (
    <ReembolsoFormDialog
      asPage
      editing={null}
      onOpenChange={(o) => { if (!o) navigate("/reembolsos"); }}
    />
  );
}
