import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/amphis/Button";
import { supabase } from "@/integrations/supabase/client";
import { USERNAME_RE, sanitizeUsername } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — Amphis" },
      { name: "description", content: "Choose your Amphis username to start your trader profile." },
      { property: "og:title", content: "Set up your profile — Amphis" },
      { property: "og:description", content: "Choose your Amphis username to start your trader profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!USERNAME_RE.test(username)) {
      setError("3–20 characters: lowercase letters, numbers, underscores.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, username } as never, { onConflict: "user_id" });
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? "That username is taken." : error.message);
      return;
    }
    navigate({ to: "/me", replace: true });
  };

  return (
    <div className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-12">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h1 className="text-3xl font-semibold tracking-tight">Choose your username.</h1>
        <input
          value={username}
          onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
          placeholder="username"
          className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <Button type="submit" className="w-full" disabled={busy}>Continue</Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </div>
  );
}
