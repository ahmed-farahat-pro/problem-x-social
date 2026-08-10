"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Input, Label, Spinner } from "@/components/ui";

export default function LoginForm({ needsSetup }: { needsSetup: boolean }) {
  const [mode, setMode] = useState<"login" | "register">(
    needsSetup ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "submitting" | "redirecting">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setPhase("submitting");
    setError(null);
    try {
      const response = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, inviteCode }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Something went wrong");

      setPhase("redirecting");

      // A full document load, deliberately — not router.replace().
      // The client router caches the RSC payload for "/", and before signing in
      // that payload was a redirect back to /login, so a soft navigation could
      // replay the redirect. Chasing it with router.refresh() then raced the
      // in-flight navigation and left the button spinning forever. A document
      // load re-runs the server render with the freshly set session cookie and
      // bypasses the router cache entirely.
      window.location.replace("/");

      // If the workspace render is slow or fails, give control back rather than
      // spinning indefinitely.
      window.setTimeout(() => {
        setError(
          "Signed in, but loading the workspace is taking a while. Reload the page to continue.",
        );
        setBusy(false);
        setPhase("idle");
      }, 15000);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-4">
      {mode === "register" && (
        <label className="grid gap-1.5">
          <Label>Your name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ahmed"
            autoComplete="name"
          />
        </label>
      )}

      <label className="grid gap-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
        />
      </label>

      <label className="grid gap-1.5">
        <Label>Password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
      </label>

      {mode === "register" && !needsSetup && (
        <label className="grid gap-1.5">
          <Label>Invite code</Label>
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="From your workspace owner"
          />
        </label>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {busy && <Spinner />}
        {phase === "redirecting"
          ? "Loading your workspace…"
          : phase === "submitting"
            ? "Signing in…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
      </Button>

      {!needsSetup && (
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setError(null);
          }}
          className="text-muted hover:text-body text-center text-xs transition-colors"
        >
          {mode === "login"
            ? "Have an invite code? Create an account"
            : "Already have an account? Sign in"}
        </button>
      )}
    </form>
  );
}
