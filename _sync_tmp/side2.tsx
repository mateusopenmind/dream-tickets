import { useState } from "react";
import { Plane, Users, Landmark, CreditCard, LogOut, Settings, UserCog, HelpCircle, RefreshCw, BarChart3, Banknote, FileBarChart2, Building2, Truck, HandCoins, Wallet, ClipboardList, Receipt, Undo2, Coins, Search, Ticket, Plus, Minus, Gift, Layers, Copy, Boxes, SlidersHorizontal, ShoppingCart, ArrowLeftRight, TrendingDown, Tag } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil, useMinhasTelas } from "@/hooks/usePerfil";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";

// Estrutura de menus por grupo. `chave` = tela no banco (controle de acesso).
// OBS Dashboard: hoje a Home ("/") é a tela de Emissões Próprias. Quando o
// Dashboard existir, ele assume a Home ("/") e "Emissões > Próprias" passa a
// apontar para uma rota própria (ex.: "/emissoes"). Basta descomentar o grupo
// Dashboard abaixo (reimportando o ícone LayoutDashboard) e trocar a url de "Próprias".
type MenuItem = { title: string; url: string; icon: typeof Plane; chave: string };
type MenuGroup = { label: string; items: MenuItem[] };

const groups: MenuGroup[] = [
  // {
  //   label: "Dashboard",
  //   items: [
  //     { title: "Dashboard", url: "/", icon: LayoutDashboard, chave: "dashboard" },
  //   ],
  // },
  {
    label: "Emissões",
    items: [
      { title: "Próprias", url: "/", icon: Plane, chave: "emissoes" },
      { title: "Terceirizadas", url: "/emissoes-terceirizadas", icon: Building2, chave: "emissoes_terceirizadas" },
      { title: "Buscar", url: "/buscar-emissao", icon: Search, chave: "buscar_emissao" },
      { title: "Relatório", url: "/relatorio-emissoes", icon: FileBarChart2, chave: "relatorio_emissoes" },
    ],
  },
  {
    label: "Reembolsos",
    items: [
      { title: "Reembolsos", url: "/reembolsos", icon: Undo2, chave: "reembolsos" },
      { title: "Retorno Milhas", url: "/reembolso-milhas", icon: Ticket, chave: "reembolso_milhas" },
      { title: "Retorno Valores", url: "/reembolso-valores", icon: CreditCard, chave: "reembolso_valores" },
    ],
  },
  {
    label: "Recebimentos",
    items: [
      { title: "Cobranças em Aberto", url: "/cobrancas-abertas", icon: Receipt, chave: "cobrancas_abertas" },
      { title: "Reprocessamento", url: "/reprocessamento", icon: RefreshCw, chave: "reprocessamento" },
      { title: "Recebimentos Avulsos", url: "/recebimentos-avulsos", icon: Wallet, chave: "recebimentos_avulsos" },
      { title: "Relatório Receb. Avulsos", url: "/relatorio-recebimentos", icon: ClipboardList, chave: "relatorio_recebimentos" },
    ],
  },
  {
    label: "Pagamentos",
    items: [
      { title: "Faciais", url: "/pagamento-facial", icon: Banknote, chave: "pagamento_facial" },
      { title: "Fornecedores", url: "/pagamento-fornecedores", icon: HandCoins, chave: "pagamento_fornecedores" },
      { title: "Reembolsos", url: "/pagamento-reembolsos", icon: Coins, chave: "pagamento_reembolsos" },
    ],
  },
  {
    label: "Saldos & Automações",
    items: [
      { title: "Relatório de Saldos", url: "/relatorio-saldos", icon: BarChart3, chave: "relatorio_saldos" },
    ],
  },
  {
    label: "Clubes",
    items: [
      { title: "Assinaturas", url: "/assinaturas", icon: Gift, chave: "assinaturas" },
      { title: "Planos", url: "/planos-clube", icon: Tag, chave: "planos_clube" },
      { title: "Modelos de Bônus", url: "/modelos-bonus", icon: Copy, chave: "bonus_modelos" },
      { title: "Conferência Clubes", url: "/estoque", icon: Layers, chave: "estoque" },
    ],
  },
  {
    label: "Estoque",
    items: [
      { title: "Acompanhamento", url: "/estoque-milhas", icon: Boxes, chave: "estoque_milhas" },
      { title: "Compras", url: "/estoque-compras", icon: ShoppingCart, chave: "estoque_compras" },
      { title: "Transferências", url: "/estoque-transferencias", icon: ArrowLeftRight, chave: "estoque_transferencias" },
      { title: "Perdas", url: "/estoque-perdas", icon: TrendingDown, chave: "estoque_perdas" },
      { title: "Ajuste", url: "/estoque-ajuste", icon: SlidersHorizontal, chave: "estoque_ajuste" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Clientes", url: "/clientes", icon: Users, chave: "clientes" },
      { title: "Contas", url: "/contas", icon: Landmark, chave: "contas" },
      { title: "Cartões", url: "/cartoes", icon: CreditCard, chave: "cartoes" },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck, chave: "fornecedores" },
      { title: "Configurações", url: "/configuracoes", icon: Settings, chave: "listas" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const { data: perfil } = usePerfil();
  const { data: telas } = useMinhasTelas();

  const isSuper = perfil?.papel === "super_admin";
  const isAdmin = perfil?.papel === "admin" || isSuper;

  // Super admin vê tudo; demais veem só as telas liberadas
  const podeVer = (chave: string) => isSuper || (telas?.has(chave) ?? false);

  // Só "Emissões" começa expandido; os demais iniciam recolhidos.
  const abertoPorPadrao = (label: string) => label === "Emissões";
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const estaAberto = (label: string) => abertos[label] ?? abertoPorPadrao(label);
  const toggle = (label: string) =>
    setAbertos((prev) => ({ ...prev, [label]: !(prev[label] ?? abertoPorPadrao(label)) }));

  // Busca no menu (ignora acentos). Quando há texto, mostra só os itens que casam.
  const [busca, setBusca] = useState("");
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const q = collapsed ? "" : norm(busca.trim());
  const filtrar = (item: MenuItem, label: string) => !q || norm(item.title).includes(q) || norm(label).includes(q);

  // Cabeçalho clicável do grupo com ícone +/- (some quando a sidebar está em modo ícone)
  const GroupLabel = ({ label }: { label: string }) => {
    if (collapsed) return <SidebarGroupLabel>{label}</SidebarGroupLabel>;
    const aberto = estaAberto(label);
    return (
      <SidebarGroupLabel asChild>
        <button
          type="button"
          onClick={() => toggle(label)}
          className="flex w-full items-center justify-between rounded-md hover:text-sidebar-accent-foreground"
          aria-expanded={aberto}
        >
          <span>{label}</span>
          {aberto ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </SidebarGroupLabel>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <NavLink to="/" end className={`flex items-center gap-2 transition-opacity hover:opacity-80 ${collapsed ? "justify-center" : ""}`} title="Ir para a Home">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Plane className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && <span className="font-display text-lg font-bold text-sidebar-primary">DreamTickets</span>}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        {!collapsed && (
          <div className="px-2 pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar menu..." className="h-8 pl-7 text-sm" />
            </div>
          </div>
        )}
        {groups.map((group) => {
          // Cadastros recebe "Usuários" (só admin) ao final
          const items = [...group.items];
          if (group.label === "Cadastros" && isAdmin) {
            items.push({ title: "Usuários", url: "/usuarios", icon: UserCog, chave: "__admin__" });
          }
          const visiveis = items
            .filter((it) => it.chave === "__admin__" || podeVer(it.chave))
            .filter((it) => filtrar(it, group.label));
          if (visiveis.length === 0) return null;

          const mostrarItens = collapsed || estaAberto(group.label) || !!q;

          return (
            <SidebarGroup key={group.label}>
              <GroupLabel label={group.label} />
              {mostrarItens && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visiveis.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50"
                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                            <item.icon className="mr-2 h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}

        {(!q || "ajuda".includes(q)) && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/ajuda" className="hover:bg-sidebar-accent/50"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Ajuda</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-sidebar-accent/50 text-sidebar-foreground/70">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
