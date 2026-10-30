import { NavLink as RouterNavLink, NavLinkProps, useLocation, useNavigate, useResolvedPath } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, onClick, ...props }, ref) => {
    const location = useLocation();
    const navigate = useNavigate();
    const destino = useResolvedPath(to);
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          // Clique no menu da tela em que já se está: recarrega a tela como página nova
          // (o <PaginaNova> remonta ao ver um carimbo novo em state.paginaNova).
          if (destino.pathname === location.pathname) {
            e.preventDefault();
            navigate(to, { replace: true, state: { paginaNova: Date.now() } });
          }
        }}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
