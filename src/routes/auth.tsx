import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Home Health Staff & Admin" },
      {
        name: "description",
        content:
          "Sign in to Home Health to clock in with GPS and photo verification or manage payroll as an administrator.",
      },
      { property: "og:title", content: "Sign in — Home Health" },
      {
        property: "og:description",
        content: "Secure access for home care staff and payroll administrators.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: role === "admin" ? "/admin" : "/clock" });
    }
  }, [user, role, loading, navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          full_name: String(form.get("full_name")),
          role: String(form.get("role") || "caregiver"),
        },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Account created. You can sign in now.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-primary">
          <HeartPulse className="h-7 w-7" />
          <span className="text-xl font-bold tracking-tight text-foreground">Home Health</span>
        </div>
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Staff and administrator access</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-4 pt-4" onSubmit={signIn}>
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input
                      id="si-pass"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4 pt-4" onSubmit={signUp}>
                  <div className="space-y-2">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" name="full_name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-role">Role</Label>
                    <Select name="role" defaultValue="caregiver">
                      <SelectTrigger id="su-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caregiver">Caregiver</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-pass">Password</Label>
                    <Input id="su-pass" name="password" type="password" required minLength={6} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}