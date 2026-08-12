import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CircleDot, MapPin, Users, Clock, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { MapMarker } from "@/components/StaffMap";

const StaffMap = lazy(() => import("@/components/StaffMap"));

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Live Staff Monitoring — CareLedger Admin" },
      {
        name: "description",
        content:
          "Track clocked-in home care staff on a live map with photo-verified time-in activity and daily notes.",
      },
      { property: "og:title", content: "Live Staff Monitoring — CareLedger Admin" },
      {
        property: "og:description",
        content: "Real-time GPS map and verification feed for field healthcare staff.",
      },
    ],
  }),
  component: MonitoringPage,
});

type FeedRow = {
  id: string;
  type: "IN" | "OUT";
  logged_at: string;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  approved: boolean;
  employees: { full_name: string; role: string } | null;
};

function MonitoringPage() {
  const [photo, setPhoto] = useState<string | null>(null);

  const { data: feed = [], refetch } = useQuery({
    queryKey: ["attendance-feed"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_logs")
        .select(
          "id, type, logged_at, latitude, longitude, photo_url, approved, employees(full_name, role)",
        )
        .order("logged_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as unknown as FeedRow[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["recent-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, note_text, created_at, employees(full_name)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as unknown as {
        id: string;
        note_text: string;
        created_at: string;
        employees: { full_name: string } | null;
      }[];
    },
  });

  const { data: staffCount = 0 } = useQuery({
    queryKey: ["staff-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      return count ?? 0;
    },
  });

  // Latest punch per employee; still "on duty" when the latest punch is IN.
  const latest = new Map<string, FeedRow>();
  feed.forEach((row) => {
    const key = row.employees?.full_name ?? row.id;
    if (!latest.has(key)) latest.set(key, row);
  });
  const onDuty = [...latest.values()].filter((r) => r.type === "IN");
  const markers: MapMarker[] = onDuty
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      name: r.employees?.full_name ?? "Staff",
      lat: r.latitude!,
      lng: r.longitude!,
      time: new Date(r.logged_at).toLocaleString(),
    }));

  const stats = [
    { label: "Active staff", value: staffCount, icon: Users },
    { label: "Currently on duty", value: onDuty.length, icon: CircleDot },
    { label: "Punches today", value: feed.filter((f) => isToday(f.logged_at)).length, icon: Clock },
    { label: "Recent notes", value: notes.length, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Real-time staff monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Live locations and photo-verified attendance from the field.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-[var(--shadow-card)]">
            <CardContent className="flex items-center gap-3 py-5">
              <div className="rounded-lg bg-accent p-2 text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden shadow-[var(--shadow-card)] lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" /> Staff on duty
            </CardTitle>
            <CardDescription>
              {markers.length
                ? `${markers.length} location${markers.length > 1 ? "s" : ""} tracked`
                : "No GPS-tagged staff on duty right now"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClientOnly
              fallback={<div className="h-[420px] w-full animate-pulse rounded-lg bg-muted" />}
            >
              <Suspense
                fallback={<div className="h-[420px] w-full animate-pulse rounded-lg bg-muted" />}
              >
                <StaffMap markers={markers} />
              </Suspense>
            </ClientOnly>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live feed</CardTitle>
            <CardDescription>Latest time in / out records</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-2 overflow-y-auto">
            {feed.length === 0 && (
              <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>
            )}
            {feed.map((row) => (
              <FeedItem key={row.id} row={row} onPhoto={setPhoto} onChanged={() => void refetch()} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily summarized notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {n.employees?.full_name ?? "Staff"}
                </span>
                <span>{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm">{n.note_text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Attendance photo</DialogTitle>
          {photo && <img src={photo} alt="Attendance verification" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

function FeedItem({
  row,
  onPhoto,
  onChanged,
}: {
  row: FeedRow;
  onPhoto: (url: string) => void;
  onChanged: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!row.photo_url) return;
    supabase.storage
      .from("attendance")
      .createSignedUrl(row.photo_url, 3600)
      .then(({ data }) => {
        if (active) setThumb(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [row.photo_url]);

  async function approve() {
    await supabase.from("attendance_logs").update({ approved: true }).eq("id", row.id);
    onChanged();
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-2">
      {thumb ? (
        <button type="button" onClick={() => onPhoto(thumb)} className="shrink-0">
          <img src={thumb} alt="Verification" className="h-12 w-12 rounded-md object-cover" />
        </button>
      ) : (
        <div className="h-12 w-12 shrink-0 rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {row.employees?.full_name ?? "Staff"}
          </span>
          <Badge variant={row.type === "IN" ? "default" : "secondary"}>{row.type}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(row.logged_at).toLocaleString()}
        </div>
      </div>
      {row.approved ? (
        <Badge variant="outline">Approved</Badge>
      ) : (
        <Button size="sm" variant="outline" onClick={() => void approve()}>
          Approve
        </Button>
      )}
    </div>
  );
}