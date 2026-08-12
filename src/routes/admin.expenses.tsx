import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { peso } from "@/lib/payroll";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/expenses")({
  head: () => ({
    meta: [
      { title: "Expense Reports — CareLedger Admin" },
      {
        name: "description",
        content:
          "Monthly salary expense trends, cost split by staff role, and cash advance totals for your home care operation.",
      },
      { property: "og:title", content: "Expense Reports — CareLedger Admin" },
      {
        property: "og:description",
        content: "Track payroll cost trends and cost distribution by role.",
      },
    ],
  }),
  component: ExpensesPage,
});

type Record_ = {
  period_start: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  employees: { role: string; full_name: string } | null;
};

const ROLE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function ExpensesPage() {
  const { data: records = [] } = useQuery({
    queryKey: ["payroll-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("period_start, gross_pay, total_deductions, net_pay, employees(role, full_name)")
        .order("period_start", { ascending: true });
      if (error) throw error;
      return data as unknown as Record_[];
    },
  });

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; gross: number; net: number }>();
    records.forEach((r) => {
      const key = r.period_start.slice(0, 7);
      const entry = map.get(key) ?? { month: key, gross: 0, net: 0 };
      entry.gross += Number(r.gross_pay);
      entry.net += Number(r.net_pay);
      map.set(key, entry);
    });
    return [...map.values()];
  }, [records]);

  const byRole = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const role = r.employees?.role ?? "unassigned";
      map.set(role, (map.get(role) ?? 0) + Number(r.net_pay));
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [records]);

  const byStaff = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      const name = r.employees?.full_name ?? "Unassigned";
      map.set(name, (map.get(name) ?? 0) + Number(r.net_pay));
    });
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [records]);

  const totalNet = records.reduce((a, r) => a + Number(r.net_pay), 0);
  const totalDeductions = records.reduce((a, r) => a + Number(r.total_deductions), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expense reports</h1>
        <p className="text-sm text-muted-foreground">
          Salary cost trends built from generated payroll records.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total net payout" value={peso(totalNet)} />
        <Stat label="Total deductions" value={peso(totalDeductions)} />
        <Stat label="Periods recorded" value={String(monthly.length)} />
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly salary expense</CardTitle>
          <CardDescription>Gross versus net payout per period</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {monthly.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip formatter={(v: number) => peso(v)} />
                <Legend />
                <Line type="monotone" dataKey="gross" stroke="var(--chart-2)" strokeWidth={2} />
                <Line type="monotone" dataKey="net" stroke="var(--chart-1)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by role</CardTitle>
            <CardDescription>Share of net payout</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {byRole.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byRole} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                    {byRole.map((_, i) => (
                      <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => peso(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top staff cost</CardTitle>
            <CardDescription>Cumulative net pay</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {byStaff.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStaff} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                  />
                  <Tooltip formatter={(v: number) => peso(v)} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No payroll data yet — generate payroll to see reports.
    </div>
  );
}