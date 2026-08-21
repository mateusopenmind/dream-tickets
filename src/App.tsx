import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import NovaEmissaoPage from "./pages/NovaEmissaoPage";
import EmissoesTerceirizadasPage from "./pages/EmissoesTerceirizadasPage";
import NovaEmissaoTerceirizadaPage from "./pages/NovaEmissaoTerceirizadaPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import PagamentoFornecedoresPage from "./pages/PagamentoFornecedoresPage";
import ReprocessamentoPage from "./pages/ReprocessamentoPage";
import ClientesPage from "./pages/ClientesPage";
import ContasPage from "./pages/ContasPage";
import CartoesPage from "./pages/CartoesPage";
import AssinaturasPage from "./pages/AssinaturasPage";
import NovaAssinaturaPage from "./pages/NovaAssinaturaPage";
import EstoquePage from "./pages/EstoquePage";
import EstoqueMilhasPage from "./pages/EstoqueMilhasPage";
import AjusteEstoquePage from "./pages/AjusteEstoquePage";
import ComprasPage from "./pages/ComprasPage";
import NovaCompraPage from "./pages/NovaCompraPage";
import TransferenciasPage from "./pages/TransferenciasPage";
import NovaTransferenciaPage from "./pages/NovaTransferenciaPage";
import PerdasPage from "./pages/PerdasPage";
import NovaPerdaPage from "./pages/NovaPerdaPage";
import ModelosBonusPage from "./pages/ModelosBonusPage";
import PlanosClubePage from "./pages/PlanosClubePage";
import RelatorioSaldosPage from "./pages/RelatorioSaldosPage";
import RelatorioEmissoesPage from "./pages/RelatorioEmissoesPage";
import BuscarEmissaoPage from "./pages/BuscarEmissaoPage";
import PagamentoFacialPage from "./pages/PagamentoFacialPage";
import RecebimentosAvulsosPage from "./pages/RecebimentosAvulsosPage";
import RelatorioRecebimentosPage from "./pages/RelatorioRecebimentosPage";
import CobrancasAbertasPage from "./pages/CobrancasAbertasPage";
import ReembolsosPage from "./pages/ReembolsosPage";
import NovaReembolsoPage from "./pages/NovaReembolsoPage";
import PagamentoReembolsosPage from "./pages/PagamentoReembolsosPage";
import ReembolsoValoresPage from "./pages/ReembolsoValoresPage";
import ReembolsoMilhasPage from "./pages/ReembolsoMilhasPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import UsuariosPage from "./pages/UsuariosPage";
import AjudaPage from "./pages/AjudaPage";
import AuthPage from "./pages/AuthPage";
import TrocarSenhaPage from "./pages/TrocarSenhaPage";
import PixPublicoPage from "./pages/PixPublicoPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  // Rota pública de pagamento Pix (sem login) — o cliente acessa pelo link enviado.
  if (window.location.pathname.startsWith("/pix/")) {
    return (
      <Routes>
        <Route path="/pix/:id" element={<PixPublicoPage />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (user.user_metadata?.deve_trocar_senha) {
    return <TrocarSenhaPage onConcluido={() => window.location.reload()} />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/emissoes/nova" element={<NovaEmissaoPage />} />
        <Route path="/emissoes-terceirizadas" element={<EmissoesTerceirizadasPage />} />
        <Route path="/emissoes-terceirizadas/nova" element={<NovaEmissaoTerceirizadaPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/pagamento-fornecedores" element={<PagamentoFornecedoresPage />} />
        <Route path="/reprocessamento" element={<ReprocessamentoPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/contas" element={<ContasPage />} />
        <Route path="/cartoes" element={<CartoesPage />} />
        <Route path="/assinaturas" element={<AssinaturasPage />} />
        <Route path="/assinaturas/nova" element={<NovaAssinaturaPage />} />
        <Route path="/assinaturas/:id/editar" element={<NovaAssinaturaPage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/estoque-milhas" element={<EstoqueMilhasPage />} />
        <Route path="/estoque-ajuste" element={<AjusteEstoquePage />} />
        <Route path="/estoque-compras" element={<ComprasPage />} />
        <Route path="/estoque-compras/nova" element={<NovaCompraPage />} />
        <Route path="/estoque-compras/:id/editar" element={<NovaCompraPage />} />
        <Route path="/estoque-transferencias" element={<TransferenciasPage />} />
        <Route path="/estoque-transferencias/nova" element={<NovaTransferenciaPage />} />
        <Route path="/estoque-transferencias/:id/editar" element={<NovaTransferenciaPage />} />
        <Route path="/estoque-perdas" element={<PerdasPage />} />
        <Route path="/estoque-perdas/nova" element={<NovaPerdaPage />} />
        <Route path="/estoque-perdas/:id/editar" element={<NovaPerdaPage />} />
        <Route path="/modelos-bonus" element={<ModelosBonusPage />} />
        <Route path="/planos-clube" element={<PlanosClubePage />} />
        <Route path="/relatorio-saldos" element={<RelatorioSaldosPage />} />
        <Route path="/relatorio-emissoes" element={<RelatorioEmissoesPage />} />
        <Route path="/buscar-emissao" element={<BuscarEmissaoPage />} />
        <Route path="/pagamento-facial" element={<PagamentoFacialPage />} />
        <Route path="/recebimentos-avulsos" element={<RecebimentosAvulsosPage />} />
        <Route path="/relatorio-recebimentos" element={<RelatorioRecebimentosPage />} />
        <Route path="/cobrancas-abertas" element={<CobrancasAbertasPage />} />
        <Route path="/reembolsos" element={<ReembolsosPage />} />
        <Route path="/reembolsos/novo" element={<NovaReembolsoPage />} />
        <Route path="/pagamento-reembolsos" element={<PagamentoReembolsosPage />} />
        <Route path="/reembolso-valores" element={<ReembolsoValoresPage />} />
        <Route path="/reembolso-milhas" element={<ReembolsoMilhasPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/ajuda" element={<AjudaPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
