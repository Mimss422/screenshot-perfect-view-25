import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  computePayroll,
  dayKey,
  peso,
  type AttendanceRow,
  type EmployeeRow,
} from "@/lib/payroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/staff_/$id")({
  head: () => ({
    meta: [
      { title: "Staff Profile — Home Health Admin" },
      {
        name: "description",
        content:
          "Attendance statistics, pay summary and daily notes history for an individual Home Health staff member.",
      },
      { property: "og:title", content: "Staff Profile — Home Health Admin" },
      {
        property: "og:description",
        content: "Individual staff attendance stats and notes history.",
      },
    ],
  }),
  component: StaffProfilePage,
});

type NoteRow = { id: string; note_text: string; created_at: string };

function rangeStart(range: "week" | "month") {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (range === "week" ? 7 : 30));
  return d;
}

function StaffProfilePage() {
  const { id } = Route.useParams();
  const [range, setRange] = useState<"week" | "month">("week");
  const since = rangeStart(range).toISOString();

  const { data: employee } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as EmployeeRow;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["employee-logs", id, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("employee_id", id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AttendanceRow[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["employee-notes", id, range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, note_text, created_at")
        .eq("employee_id", id)
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NoteRow[];
    },
  });

  const summary = employee ? computePayroll(employee, logs, 0) : null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/staff">
          <ArrowLeft className="h-4 w-4" /> Back to staff
        </Link>
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {employee?.full_name ?? "Staff profile"}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="capitalize">{employee?.role}</span>
            {employee?.contact ? ` · ${employee.contact}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {employee?.archived_at ? <Badge variant="secondary">Archived</Badge> : null}
          <Tabs value={range} onValueChange={(v) => setRange(v as "week" | "month")}>
            <TabsList>
              <TabsTrigger value="week">Last 7 days</TabsTrigger>
              <TabsTrigger value="month">Last 30 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Days worked", value: String(summary?.days_worked ?? 0) },
          { label: "Visits", value: String(summary?.visits ?? 0) },
          { label: "Late time-ins", value: String(summary?.lates ?? 0) },
          { label: "Gross pay (period)", value: peso(summary?.gross_pay ?? 0) },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance history</CardTitle>
            <CardDescription>Most recent clock events first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance in this period.</p>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {l.type === "IN" ? "Time in" : "Time out"} · {dayKey(l.logged_at)}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(l.logged_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge variant={l.type === "IN" ? "default" : "secondary"}>{l.type}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes summary</CardTitle>
            <CardDescription>Daily notes submitted by this staff member.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes in this period.</p>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="rounded-md border p-3 text-sm">
                  <p className="text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{n.note_text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
