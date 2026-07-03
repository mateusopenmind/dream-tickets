import { Plane, Users, Landmark, CreditCard, LogOut, Settings, UserCog, HelpCircle, RefreshCw, BarChart3, Banknote } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePerfil, useMinhasTelas } from "@/hooks/usePerfil";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

// chave = corresponde a tela no banco (controle de acesso)
const items = [
  { title: "Emissões", url: "/", icon: Plane, chave: "emissoes" },
  { title: "Reprocessamento", url: "/reprocessamento", icon: RefreshCw, chave: "reprocessamento" },
  { title: "Clientes", url: "/clientes", icon: Users, chave: "clientes" },
  { title: "Contas", url: "/contas", icon: Landmark, chave: "contas" },
  { title: "Cartões", url: "/cartoes", icon: CreditCard, chave: "cartoes" },
  { title: "Relatório de Saldos", url: "/relatorio-saldos", icon: BarChart3, chave: "relatorio_saldos" },
  { title: "Pagamento Facial", url: "/pagamento-facial", icon: Banknote, chave: "pagamento_facial" },
  { title: "Configurações", url: "/configuracoes", icon: Settings, chave: "listas" },
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
  const visiveis = items.filter((it) => isSuper || (telas?.has(it.chave) ?? false));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <Plane className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && <span className="font-display text-lg font-bold text-sidebar-primary">DreamTickets</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
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
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/usuarios" className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <UserCog className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Usuários</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
