import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import bs58 from "bs58";
import { useEffect, useState } from "react";

import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { WalletAddress } from "./WalletAddress";
import { WalletButton } from "./WalletButton";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeUsername, type MyProfile } from "@/lib/account";
import { useWallet } from "@/lib/solana/WalletContext";
import { buildLinkMessage, linkWallet } from "@/lib/wallet-link.functions";
import { polishBio } from "@/lib/ai/bio.functions";

export const inputCls =
  "h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:ring-1 focus:ring-ring";

type Status = "idle" | "checking" | "available" | "taken" | "reserved" | "invalid";
const STATUS_TEXT: Record<Status, string> = {
  idle: "",
  checking: "Checking…",
  available: "Available",
  taken: "Already taken",
  reserved: "Reserved name",
  invalid: "3–20 characters: lowercase letters, numbers, underscores",
};

/** Username + picture + bio. Saves via the signed-in user's own row (RLS). */
export function ProfileEditor({
  userId,
  profile,
  submitLabel = "Save",
  onSaved,
}: {
  userId: string;
  profile: MyProfile | null | undefined;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [prevBio, setPrevBio] = useState<string | null>(null);
  const polishFn = useServerFn(polishBio);
  async function polish() {
    setPolishing(true);
    setPolishError(null);
    try {
      const r = await polishFn({ data: { draft: bio } });
      if (r.bio) { setPrevBio(bio); setBio(r.bio); } else setPolishError(r.error);
    } catch {
      setPolishError("Couldn't polish the bio right now.");
    } finally {
      setPolishing(false);
    }
  }
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? "");
  }, [profile?.username, profile?.bio]);

  useEffect(() => {
    if (!username) return setStatus("idle");
    setStatus("checking");
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc("check_username", { _u: username });
      setStatus((data as Status) ?? "invalid");
    }, 350);
    return () => window.clearTimeout(t);
  }, [username]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) return setError("Use a PNG, JPG, WEBP or GIF image.");
    if (f.size > 2 * 1024 * 1024) return setError("Image must be 2 MB or smaller.");
    setFile(f);
  };

  const save = async () => {
    if (status !== "available") return setError("Choose an available username.");
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let avatar_url = profile?.avatar_url ?? null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: up } = await supabase.storage
          .from("avatars")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (up) throw up;
        avatar_url = path;
      }
      const row = { username, bio: bio.trim() || null, avatar_url };
      const { error: e } = profile
        ? await supabase.from("profiles").update(row).eq("user_id", userId)
        : await supabase.from("profiles").insert({ ...row, user_id: userId });
      if (e) throw new Error(e.code === "23505" ? "That username is taken." : e.message);
      setFile(null);
      setSaved(true);
      await qc.invalidateQueries({ queryKey: ["my-profile", userId] });
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar path={profile?.avatar_url} src={preview} size={72} />
        <label className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {profile?.avatar_url || file ? "Change picture" : "Upload picture"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
      </div>
      <div>
        <label className="text-xs text-muted-foreground" htmlFor="username">Username</label>
        <div className="relative mt-1">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">@</span>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
            className={`${inputCls} pl-7`}
            placeholder="username"
            autoComplete="off"
          />
        </div>
        <p className={`mt-1 text-xs ${status === "available" ? "text-accent" : "text-muted-foreground"}`}>
          {STATUS_TEXT[status]}
        </p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="bio">Bio</label>
          <button
            type="button"
            onClick={polish}
            disabled={polishing || bio.trim().length < 3}
            className="text-xs text-accent hover:underline disabled:opacity-40 disabled:no-underline"
          >
            {polishing ? "Polishing…" : "Polish with AI"}
          </button>
        </div>
        <textarea
          id="bio"
          value={bio}
          maxLength={160}
          onChange={(e) => setBio(e.target.value)}
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder="Optional, up to 160 characters"
        />
        {prevBio !== null ? (
          <p className="mt-1 text-xs text-muted-foreground">
            AI suggestion applied. Review before saving.{" "}
            <button type="button" className="underline" onClick={() => { setBio(prevBio); setPrevBio(null); }}>Undo</button>
          </p>
        ) : null}
        {polishError ? <p className="mt-1 text-xs text-destructive">{polishError}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={busy || status !== "available"}>
        {busy ? "Saving…" : submitLabel}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved && !onSaved ? <p className="text-sm text-accent">Saved.</p> : null}
    </form>
  );
}

/** Connect a wallet and prove ownership with a free message signature. */
export function WalletLinker({
  userId,
  linked,
  onLinked,
}: {
  userId: string;
  linked: string | null | undefined;
  onLinked?: () => void;
}) {
  const qc = useQueryClient();
  const { address, signMessage } = useWallet();
  const link = useServerFn(linkWallet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const issuedAt = new Date().toISOString();
      const sig = await signMessage(buildLinkMessage(userId, address, issuedAt));
      await link({ data: { address, issuedAt, signature: bs58.encode(sig) } });
      await qc.invalidateQueries({ queryKey: ["my-profile", userId] });
      onLinked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link wallet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {linked ? (
        <div>
          <p className="text-xs text-muted-foreground">Verified wallet</p>
          <WalletAddress address={linked} className="mt-1" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No wallet verified yet.</p>
      )}
      {!address ? (
        <WalletButton />
      ) : address === linked ? null : (
        <>
          <p className="text-xs text-muted-foreground">
            Connected: <span className="font-mono">{address.slice(0, 4)}…{address.slice(-4)}</span>. Sign a free
            message to prove you own it — no transaction, no fee, no approval.
          </p>
          <Button onClick={() => void verify()} disabled={busy} className="w-full">
            {busy ? "Waiting for signature…" : linked ? "Verify this wallet instead" : "Verify wallet"}
          </Button>
        </>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
