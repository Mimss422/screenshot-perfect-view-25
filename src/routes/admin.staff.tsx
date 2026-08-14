import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, KeyRound, Plus, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { peso, type EmployeeRow, type SalaryStructure } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({
    meta: [
      { title: "Staff & Salary Structures — Home Health Admin" },
      {
        name: "description",
        content:
          "Add doctors, nurses, caregivers and admin staff, attach their payroll rule, issue passcodes and archive people who have left.",
      },
      { property: "og:title", content: "Staff & Salary Structures — Home Health Admin" },
      {
        property: "og:description",
        content: "Manage Home Health staff records, passcodes and salary structures.",
      },
    ],
  }),
  component: StaffPage,
});

const defaultsByRole: Record<string, SalaryStructure> = {
  doctor: "rate_per_visit",
  nurse: "rate_per_visit",
  caregiver: "daily_rate",
  admin: "fixed_monthly",
};

const structureLabel: Record<SalaryStructure, string> = {
  rate_per_visit: "Rate per visit",
  daily_rate: "Daily rate + late deductions",
  fixed_monthly: "Fixed monthly",
};

/** 8-character passcode from an unambiguous alphabet (no O/0/I/1). */
function generatePasscode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const [role, setRole] = useState("caregiver");
  const [structure, setStructure] = useState<SalaryStructure>("daily_rate");
  const [issued, setIssued] = useState<{ name: string; passcode: string } | null>(null);

  const { data: staff = [] } = useQuery({
    queryKey: ["employees", view],
    queryFn: async () => {
      const query = supabase.from("employees").select("*").order("full_name", { ascending: true });
      const { data, error } =
        view === "active" ? await query.is("archived_at", null) : await query.not("archived_at", "is", null);
      if (error) throw error;
      return data as unknown as EmployeeRow[];
    },
  });

  async function issuePasscode(employeeId: string, name: string) {
    const passcode = generatePasscode();
    const { error } = await supabase.rpc("set_staff_passcode", {
      _employee_id: employeeId,
      _passcode: passcode,
    });
    if (error) throw error;
    setIssued({ name, passcode });
    void qc.invalidateQueries({ queryKey: ["employees"] });
  }

  const create = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("employees")
        .insert(values as never)
        .select("id, full_name")
        .single();
      if (error) throw error;
      await issuePasscode(data.id as string, data.full_name as string);
    },
    onSuccess: () => {
      toast.success("Staff member added and passcode generated.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPasscode = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => issuePasscode(id, name),
    onSuccess: () => toast.success("New passcode generated."),
    onError: (e: Error) => toast.error(e.message),
  });

  const setArchived = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("employees")
        .update({ archived_at: archived ? new Date().toISOString() : null, active: !archived })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.archived ? "Staff member archived." : "Staff member restored.");
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      full_name: String(f.get("full_name")),
      role,
      salary_structure: structure,
      rate_per_visit: Number(f.get("rate_per_visit") || 0),
      daily_rate: Number(f.get("daily_rate") || 0),
      fixed_monthly: Number(f.get("fixed_monthly") || 0),
      late_deduction: Number(f.get("late_deduction") || 0),
      pay_periods: Number(f.get("pay_periods") || 1),
      contact: String(f.get("contact") || ""),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff management</h1>
          <p className="text-sm text-muted-foreground">
            Payroll rules and clock-in passcodes are attached to each person here.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New staff member</DialogTitle>
              <DialogDescription>
                Choosing a role preselects the matching salary formula. A passcode is generated
                automatically after saving.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => {
                      setRole(v);
                      setStructure(defaultsByRole[v] ?? "daily_rate");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="caregiver">Caregiver</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Salary structure</Label>
                  <Select
                    value={structure}
                    onValueChange={(v) => setStructure(v as SalaryStructure)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rate_per_visit">Rate per visit</SelectItem>
                      <SelectItem value="daily_rate">Daily rate</SelectItem>
                      <SelectItem value="fixed_monthly">Fixed monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {structure === "rate_per_visit" && (
                <Field name="rate_per_visit" label="Rate per visit" />
              )}
              {structure === "daily_rate" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="daily_rate" label="Daily rate" />
                  <Field name="late_deduction" label="Deduction per late" />
                </div>
              )}
              {structure === "fixed_monthly" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field name="fixed_monthly" label="Monthly salary" />
                  <Field name="pay_periods" label="Pay periods / month" defaultValue="2" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                <Input id="contact" name="contact" />
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Save staff member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "active" | "archived")}>
        <TabsList>
          <TabsTrigger value="active">Active staff</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {view === "active" ? "Team" : "Archived staff"}
          </CardTitle>
          <CardDescription>
            {staff.length} record{staff.length === 1 ? "" : "s"}
            {view === "archived" && " · history and payroll stay available"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salary structure</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Passcode</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/admin/staff/$id"
                      params={{ id: s.id }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {s.full_name}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{s.role}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{structureLabel[s.salary_structure]}</Badge>
                  </TableCell>
                  <TableCell>
                    {s.salary_structure === "rate_per_visit" && `${peso(s.rate_per_visit)} / visit`}
                    {s.salary_structure === "daily_rate" &&
                      `${peso(s.daily_rate)} / day · -${peso(s.late_deduction)} late`}
                    {s.salary_structure === "fixed_monthly" &&
                      `${peso(s.fixed_monthly)} / mo · ${s.pay_periods}x`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.passcode_set_at
                      ? `Issued ${new Date(s.passcode_set_at).toLocaleDateString()}`
                      : "Not set"}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {view === "active" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reset passcode"
                          onClick={() => resetPasscode.mutate({ id: s.id, name: s.full_name })}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Archive staff member"
                          onClick={() => setArchived.mutate({ id: s.id, archived: true })}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setArchived.mutate({ id: s.id, archived: false })}
                      >
                        <RotateCcw className="h-4 w-4" /> Restore
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {view === "active"
                      ? "No staff yet. Add your first team member."
                      : "No archived staff."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Passcode for {issued?.name}</DialogTitle>
            <DialogDescription>
              Shown once only — the system stores an encrypted version. Give it to the staff member
              now; you can always generate a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted p-4 text-center text-2xl font-bold tracking-[0.3em]">
            {issued?.passcode}
          </div>
          <Button onClick={() => setIssued(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue = "0",
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step="0.01" min="0" defaultValue={defaultValue} />
    </div>
  );
}
