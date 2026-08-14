import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BarChart3, HeartPulse, Users, Wallet, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Monitoring", icon: Activity, exact: true },
  { to: "/admin/staff", label: "Staff", icon: Users, exact: false },
  { to: "/admin/payroll", label: "Payroll", icon: Wallet, exact: false },
  { to: "/admin/expenses", label: "Expenses", icon: BarChart3, exact: false },
] as const;

function AdminLayout() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (role && role !== "admin") navigate({ to: "/clock" });
  }, [user, role, loading, navigate]);

  if (loading || !user || role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 text-primary">
            <HeartPulse className="h-5 w-5" />
            <span className="font-bold text-foreground">Home Health</span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              Admin
            </span>
          </div>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}