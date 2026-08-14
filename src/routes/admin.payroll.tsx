import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, Plus, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  computePayroll,
  peso,
  type AttendanceRow,
  type ComputedPayroll,
  type EmployeeRow,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll Processing — Home Health Admin" },
      {
        name: "description",
        content:
          "Generate payroll from verified attendance: per-visit fees, daily rates with late deductions, fixed monthly salaries and cash advances.",
      },
      { property: "og:title", content: "Payroll Processing — Home Health Admin" },
      {
        property: "og:description",
        content: "Automated payroll computation and printable salary receipts.",
      },
    ],
  }),
  component: PayrollPage,
});

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function PayrollPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [results, setResults] = useState<ComputedPayroll[] | null>(null);
  const [receipt, setReceipt] = useState<ComputedPayroll | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const { start, end } = monthBounds(month);

  const { data: staff = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true);
      if (error) throw error;
      return data as unknown as EmployeeRow[];
    },
  });

  const { data: saved = [] } = useQuery({
    queryKey: ["payroll", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*, employees(full_name, role)")
        .eq("period_start", start)
        .eq("period_end", end);
      if (error) throw error;
      return data as unknown as (ComputedPayroll & {
        id: string;
        employees: { full_name: string; role: string } | null;
      })[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const [{ data: logs, error: e1 }, { data: adv, error: e2 }] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("id, employee_id, user_id, type, logged_at, latitude, longitude, photo_url, approved")
          .gte("logged_at", `${start}T00:00:00Z`)
          .lte("logged_at", `${end}T23:59:59Z`)
          .eq("approved", true),
        supabase
          .from("deductions")
          .select("employee_id, amount")
          .gte("effective_date", start)
          .lte("effective_date", end),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const byEmployee = new Map<string, AttendanceRow[]>();
      (logs as unknown as AttendanceRow[]).forEach((l) => {
        if (!l.employee_id) return;
        byEmployee.set(l.employee_id, [...(byEmployee.get(l.employee_id) ?? []), l]);
      });
      const advByEmployee = new Map<string, number>();
      (adv ?? []).forEach((d) => {
        advByEmployee.set(
          d.employee_id as string,
          (advByEmployee.get(d.employee_id as string) ?? 0) + Number(d.amount),
        );
      });

      const computed = staff.map((emp) =>
        computePayroll(emp, byEmployee.get(emp.id) ?? [], advByEmployee.get(emp.id) ?? 0),
      );

      const rows = computed.map((c) => ({
        employee_id: c.employee.id,
        period_start: start,
        period_end: end,
        days_worked: c.days_worked,
        visits: c.visits,
        lates: c.lates,
        gross_pay: c.gross_pay,
        total_deductions: c.total_deductions,
        net_pay: c.net_pay,
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("payroll_records")
          .upsert(rows as never, { onConflict: "employee_id,period_start,period_end" });
        if (error) throw error;
      }
      return computed;
    },
    onSuccess: (computed) => {
      setResults(computed);
      toast.success("Payroll generated.");
      void qc.invalidateQueries({ queryKey: ["payroll"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAdvance = useMutation({
    mutationFn: async (values: { employee_id: string; amount: number; note: string }) => {
      const { error } = await supabase.from("deductions").insert({
        ...values,
        kind: "cash_advance",
        effective_date: new Date().toISOString().slice(0, 10),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cash advance recorded.");
      setAdvanceOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows =
    results ??
    saved.map((r) => ({
      ...r,
      employee: {
        ...(staff.find((s) => s.id === (r as unknown as { employee_id: string }).employee_id) ??
          ({ full_name: r.employees?.full_name ?? "Staff", role: "caregiver" } as EmployeeRow)),
      },
    })) as ComputedPayroll[];

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + Number(r.gross_pay),
      ded: acc.ded + Number(r.total_deductions),
      net: acc.net + Number(r.net_pay),
    }),
    { gross: 0, ded: 0, net: 0 },
  );

  return (
    <div className="space-y-6 print:space-y-0">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll processing</h1>
          <p className="text-sm text-muted-foreground">
            Computed from approved attendance for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="month" className="text-xs">
              Period
            </Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setResults(null);
              }}
              className="w-[170px]"
            />
          </div>
          <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4" /> Cash advance
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record cash advance</DialogTitle>
                <DialogDescription>Deducted from the next generated payroll.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  addAdvance.mutate({
                    employee_id: String(f.get("employee_id")),
                    amount: Number(f.get("amount")),
                    note: String(f.get("note") || ""),
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Staff member</Label>
                  <Select name="employee_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note</Label>
                  <Input id="note" name="note" />
                </div>
                <Button type="submit" className="w-full" disabled={addAdvance.isPending}>
                  Save
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            <Calculator className="h-4 w-4" /> Generate payroll
          </Button>
        </div>
      </div>

      <Card className="shadow-[var(--shadow-card)] print:hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Payroll register · {new Date(`${month}-01`).toLocaleString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
          <CardDescription>
            Gross {peso(totals.gross)} · Deductions {peso(totals.ded)} · Net {peso(totals.net)}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Structure</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Lates</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee.id}>
                  <TableCell className="font-medium">{r.employee.full_name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {r.employee.salary_structure?.replaceAll("_", " ")}
                  </TableCell>
                  <TableCell className="text-right">{r.days_worked}</TableCell>
                  <TableCell className="text-right">{r.visits}</TableCell>
                  <TableCell className="text-right">{r.lates}</TableCell>
                  <TableCell className="text-right">{peso(Number(r.gross_pay))}</TableCell>
                  <TableCell className="text-right">{peso(Number(r.total_deductions))}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {peso(Number(r.net_pay))}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setReceipt(r)}>
                      Receipt
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No payroll for this period yet. Click “Generate payroll”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salary receipt</DialogTitle>
            <DialogDescription>
              {new Date(`${month}-01`).toLocaleString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </DialogDescription>
          </DialogHeader>
          {receipt && (
            <div id="receipt" className="space-y-4 rounded-lg border border-border p-5">
              <div className="border-b border-border pb-3">
                <div className="text-lg font-bold">{receipt.employee.full_name}</div>
                <div className="text-sm capitalize text-muted-foreground">
                  {receipt.employee.role} · {receipt.employee.salary_structure?.replaceAll("_", " ")}
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <Line label="Days worked" value={String(receipt.days_worked)} />
                <Line label="Visits" value={String(receipt.visits)} />
                <Line label="Late arrivals" value={String(receipt.lates)} />
                <Line label="Gross pay" value={peso(Number(receipt.gross_pay))} />
                <Line label="Deductions" value={`- ${peso(Number(receipt.total_deductions))}`} />
              </dl>
              <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
                <span>Net pay</span>
                <span>{peso(Number(receipt.net_pay))}</span>
              </div>
            </div>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}