import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, HeartPulse, LogIn, LogOut, MapPin, NotebookPen, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/clock")({
  head: () => ({
    meta: [
      { title: "Staff Clock In — Home Health" },
      {
        name: "description",
        content:
          "Home care staff clock in and out with live GPS and photo verification, and submit daily service notes.",
      },
      { property: "og:title", content: "Staff Clock In — Home Health" },
      {
        property: "og:description",
        content: "GPS and photo verified time in / time out for field healthcare staff.",
      },
    ],
  }),
  component: ClockPage,
});

type PendingItem = {
  id: string;
  kind: "punch" | "note";
  payload: Record<string, unknown>;
};

const QUEUE_KEY = "careledger_offline_queue";

function readQueue(): PendingItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as PendingItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: PendingItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function ClockPage() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [mode, setMode] = useState<"IN" | "OUT" | null>(null);
  const [note, setNote] = useState("");
  const [lastPunch, setLastPunch] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
    if (!loading && role === "admin") navigate({ to: "/admin" });
  }, [user, role, loading, navigate]);

  useEffect(() => {
    setPending(readQueue());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setEmployeeId(data?.id ?? null);
        setName(data?.full_name ?? user.email ?? "");
      });
    supabase
      .from("attendance_logs")
      .select("type, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLastPunch(`${data.type} · ${new Date(data.logged_at).toLocaleString()}`);
      });
  }, [user]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setMode(null);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  async function startCapture(type: "IN" | "OUT") {
    setMode(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      toast.error("Camera access is required to record attendance.");
      setMode(null);
    }
  }

  function getPosition(): Promise<GeolocationPosition | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    });
  }

  async function uploadPhoto(dataUrl: string) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${user!.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("attendance")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    return path;
  }

  async function confirmPunch() {
    if (!mode || !videoRef.current || !user) return;
    setBusy(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 640;
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      const pos = await getPosition();

      const payload = {
        user_id: user.id,
        employee_id: employeeId,
        type: mode,
        logged_at: new Date().toISOString(),
        latitude: pos?.coords.latitude ?? null,
        longitude: pos?.coords.longitude ?? null,
      };

      stopCamera();

      if (navigator.onLine) {
        const path = await uploadPhoto(dataUrl);
        const { error } = await supabase
          .from("attendance_logs")
          .insert({ ...payload, photo_url: path, sync_status: "synced" });
        if (error) throw error;
        setLastPunch(`${payload.type} · ${new Date(payload.logged_at).toLocaleString()}`);
        toast.success(`Time ${mode === "IN" ? "in" : "out"} recorded.`);
      } else {
        const next = [
          ...readQueue(),
          {
            id: crypto.randomUUID(),
            kind: "punch" as const,
            payload: { ...payload, photo: dataUrl },
          },
        ];
        writeQueue(next);
        setPending(next);
        toast.message("Saved locally (pending sync)");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record attendance.");
    } finally {
      setBusy(false);
    }
  }

  async function submitNote() {
    if (!note.trim() || !user) return;
    setBusy(true);
    const payload = { user_id: user.id, employee_id: employeeId, note_text: note.trim() };
    if (navigator.onLine) {
      const { error } = await supabase.from("daily_notes").insert(payload);
      if (error) toast.error(error.message);
      else {
        toast.success("Daily note submitted.");
        setNote("");
      }
    } else {
      const next = [...readQueue(), { id: crypto.randomUUID(), kind: "note" as const, payload }];
      writeQueue(next);
      setPending(next);
      setNote("");
      toast.message("Saved locally (pending sync)");
    }
    setBusy(false);
  }

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || !user) return;
    const queue = readQueue();
    if (queue.length === 0) return;
    const remaining: PendingItem[] = [];
    for (const item of queue) {
      try {
        if (item.kind === "note") {
          const { error } = await supabase.from("daily_notes").insert(item.payload as never);
          if (error) throw error;
        } else {
          const { photo, ...rest } = item.payload as { photo?: string } & Record<string, unknown>;
          let photo_url: string | null = null;
          if (photo) photo_url = await uploadPhoto(photo);
          const { error } = await supabase
            .from("attendance_logs")
            .insert({ ...rest, photo_url, sync_status: "synced" } as never);
          if (error) throw error;
        }
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    setPending(remaining);
    if (remaining.length < queue.length) toast.success("Pending records synced.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void syncQueue();
    const timer = setInterval(() => void syncQueue(), 60_000);
    return () => clearInterval(timer);
  }, [user, online, syncQueue]);

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-primary">
            <HeartPulse className="h-5 w-5" />
            <span className="font-bold text-foreground">Home Health</span>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <Badge variant="outline" className="gap-1 text-warning-foreground">
                <WifiOff className="h-3 w-3" /> Offline
              </Badge>
            )}
            {pending.length > 0 && <Badge variant="destructive">{pending.length} pending</Badge>}
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardDescription>{new Date().toDateString()}</CardDescription>
            <CardTitle className="text-2xl">{name || "Staff"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {lastPunch ? `Last activity: ${lastPunch}` : "No attendance recorded yet."}
          </CardContent>
        </Card>

        {cameraOn ? (
          <Card className="overflow-hidden shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-4 w-4" /> Verify Time {mode === "IN" ? "In" : "Out"}
              </CardTitle>
              <CardDescription>Live photo and GPS are captured together.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-[3/4] w-full rounded-lg bg-muted object-cover"
              />
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => void confirmPunch()}>
                  Capture & submit
                </Button>
                <Button variant="outline" onClick={stopCamera} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-24 flex-col gap-2"
              onClick={() => void startCapture("IN")}
            >
              <LogIn className="h-6 w-6" />
              Time In
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-24 flex-col gap-2"
              onClick={() => void startCapture("OUT")}
            >
              <LogOut className="h-6 w-6" />
              Time Out
            </Button>
          </div>
        )}

        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="h-4 w-4" /> Daily summarized note
            </CardTitle>
            <CardDescription>Summary of healthcare services rendered today.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Assisted patient with morning medication, vitals stable..."
            />
            <Button
              className="w-full"
              variant="outline"
              disabled={busy || !note.trim()}
              onClick={() => void submitNote()}
            >
              Submit note
            </Button>
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> Location and photo are required for verified attendance.
        </p>
      </div>
    </main>
  );
}