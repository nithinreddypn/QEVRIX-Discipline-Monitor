import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const primaryRole = roles[0] ?? "student";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.25} />
            </span>
            <span className="font-display text-[15px] font-semibold tracking-tight text-foreground">
              QEVRIX <span className="text-muted-foreground font-normal">Discipline Monitor</span>
            </span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-sm hover:bg-secondary transition-colors">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-foreground">
                <UserIcon className="h-3.5 w-3.5" />
              </span>
              <span className="hidden pr-1 text-[13px] font-medium sm:inline">
                {user?.email ?? "Account"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Signed in as
                <div className="mt-0.5 truncate text-sm font-medium text-foreground">{user?.email}</div>
                <div className="mt-1 inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium capitalize text-accent-foreground">
                  {primaryRole}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut} className="text-sm">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}

const MARKETING_LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/features", label: "Features" },
  { to: "/technology", label: "Technology" },
  { to: "/team", label: "Team" },
  { to: "/contact", label: "Contact" },
] as const;

export function MarketingShell({
  children,
  transparentTop = false,
}: {
  children: ReactNode;
  transparentTop?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparentTop) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentTop]);

  const overlay = transparentTop && !scrolled;

  return (
    <div className="min-h-screen bg-background">
      <header
        className={[
          "fixed top-0 left-0 right-0 z-40 transition-colors duration-300",
          overlay
            ? "bg-transparent border-b border-white/10"
            : "glass-panel border-b",
        ].join(" ")}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span
              className={[
                "grid h-8 w-8 place-items-center rounded-lg shadow-sm transition-colors",
                overlay
                  ? "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur"
                  : "bg-primary text-primary-foreground",
              ].join(" ")}
            >
              <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.25} />
            </span>
            <span
              className={[
                "font-display text-[15px] font-semibold tracking-tight transition-colors",
                overlay ? "text-white" : "text-foreground",
              ].join(" ")}
            >
              QEVRIX{" "}
              <span
                className={
                  overlay ? "font-normal text-white/70" : "font-normal text-muted-foreground"
                }
              >
                Discipline Monitor
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {MARKETING_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className={[
                  "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  overlay
                    ? "text-white/80 hover:text-white"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                activeProps={{
                  className: overlay ? "text-white" : "text-foreground",
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/login"
            className={
              overlay
                ? "inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_rgb(34_197_94/0.25),0_6px_16px_-4px_rgb(34_197_94/0.35)] transition hover:brightness-110"
                : "btn-primary text-sm"
            }
          >
            Login
          </Link>
        </div>
      </header>
      {/* Spacer for non-overlay pages so content isn't hidden under fixed nav */}
      {!transparentTop && <div className="h-16" aria-hidden />}
      {children}
    </div>
  );
}
