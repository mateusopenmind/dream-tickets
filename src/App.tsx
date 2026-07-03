import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import NovaEmissaoPage from "./pages/NovaEmissaoPage";
import ReprocessamentoPage from "./pages/ReprocessamentoPage";
import ClientesPage from "./pages/ClientesPage";
import ContasPage from "./pages/ContasPage";
import CartoesPage from "./pages/CartoesPage";
import RelatorioSaldosPage from "./pages/RelatorioSaldosPage";
import PagamentoFacialPage from "./pages/PagamentoFacialPage";
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
        <Route path="/reprocessamento" element={<ReprocessamentoPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/contas" element={<ContasPage />} />
        <Route path="/cartoes" element={<CartoesPage />} />
        <Route path="/relatorio-saldos" element={<RelatorioSaldosPage />} />
        <Route path="/pagamento-facial" element={<PagamentoFacialPage />} />
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
