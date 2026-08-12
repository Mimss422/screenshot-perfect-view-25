import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, Clock, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareLedger — Home Care Attendance & Payroll" },
      {
        name: "description",
        content:
          "Verified GPS and photo clock-ins for doctors, nurses and caregivers, with automated payroll built from every approved shift.",
      },
      { property: "og:title", content: "CareLedger — Home Care Attendance & Payroll" },
      {
        property: "og:description",
        content:
          "Field staff clock in with GPS and photo verification; admins approve shifts and generate payroll automatically.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !session) return;
    void navigate({ to: role === "admin" ? "/admin" : "/clock" });
  }, [loading, session, role, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold">
            <Activity className="h-5 w-5 text-primary" />
            CareLedger
          </div>
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Verified attendance for home care teams
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
          Every shift verified. Every payslip automatic.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Field staff clock in with a live photo and GPS pin — even offline. Admins review the
          evidence, approve the shift, and payroll computes itself for per-visit, daily-rate and
          fixed-salary staff.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/clock">Staff clock in</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        <Feature
          icon={<Clock className="h-5 w-5 text-primary" />}
          title="Offline-first clock in"
          body="Shifts queue locally in poor signal areas and sync the moment connection returns."
        />
        <Feature
          icon={<MapPin className="h-5 w-5 text-primary" />}
          title="Live staff map"
          body="See who is on duty, where they clocked in, and review their verification photo."
        />
        <Feature
          icon={<Wallet className="h-5 w-5 text-primary" />}
          title="Automated payroll"
          body="Visits, days worked, lates and cash advances roll into a printable salary receipt."
        />
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-left shadow-[var(--shadow-card)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
        {icon}
      </div>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
