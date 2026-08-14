import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { peso, type EmployeeRow, type SalaryStructure } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
          "Add doctors, nurses, caregivers and admin staff, and attach the payroll rule that applies to each of them.",
      },
      { property: "og:title", content: "Staff & Salary Structures — Home Health Admin" },
      {
        property: "og:description",
        content: "Manage home care staff records and salary structures.",
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

function StaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("caregiver");
  const [structure, setStructure] = useState<SalaryStructure>("daily_rate");

  const { data: staff = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as unknown as EmployeeRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase.from("employees").insert(values as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Staff member added.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["employees"] }),
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
      bank_details: String(f.get("bank_details") || ""),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff management</h1>
          <p className="text-sm text-muted-foreground">
            Payroll rules are attached to each person here.
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
                Choosing a role preselects the matching salary formula.
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact</Label>
                  <Input id="contact" name="contact" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_details">Bank details</Label>
                  <Input id="bank_details" name="bank_details" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={create.isPending}>
                Save staff member
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Team</CardTitle>
          <CardDescription>{staff.length} staff records</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Salary structure</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
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
                  <TableCell className="text-muted-foreground">{s.contact || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No staff yet. Add your first team member.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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