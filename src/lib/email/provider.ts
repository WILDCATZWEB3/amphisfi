/**
 * Email notification channel.
 * Off cleanly when EMAIL_PROVIDER / API key missing — never sends without real config.
 */

export type EmailProviderId = "resend" | "none";

export type EmailSendInput = {
  to: string;
  subject: string;
  text: string;
};

export type EmailSendResult =
  | { sent: true; provider: "resend"; id: string }
  | { sent: false; reason: string; provider: EmailProviderId };

export function emailProviderStatus(): {
  enabled: boolean;
  provider: EmailProviderId;
  fromConfigured: boolean;
  reason?: string;
} {
  const provider = (process.env["EMAIL_PROVIDER"] ?? "").trim().toLowerCase();
  const from = (process.env["EMAIL_FROM"] ?? "").trim();
  if (!provider || provider === "none" || provider === "off") {
    return {
      enabled: false,
      provider: "none",
      fromConfigured: Boolean(from),
      reason: "EMAIL_PROVIDER unset or off",
    };
  }
  if (provider !== "resend") {
    return {
      enabled: false,
      provider: "none",
      fromConfigured: Boolean(from),
      reason: `Unsupported EMAIL_PROVIDER (${provider}); only "resend" is implemented`,
    };
  }
  const key = (process.env["RESEND_API_KEY"] ?? "").trim();
  if (!key) {
    return {
      enabled: false,
      provider: "resend",
      fromConfigured: Boolean(from),
      reason: "RESEND_API_KEY missing",
    };
  }
  if (!from || !from.includes("@")) {
    return {
      enabled: false,
      provider: "resend",
      fromConfigured: false,
      reason: "EMAIL_FROM missing or invalid",
    };
  }
  return { enabled: true, provider: "resend", fromConfigured: true };
}

export async function sendEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const status = emailProviderStatus();
  if (!status.enabled) {
    return { sent: false, reason: status.reason ?? "email disabled", provider: status.provider };
  }
  if (status.provider !== "resend") {
    return { sent: false, reason: "no provider", provider: "none" };
  }
  const key = process.env["RESEND_API_KEY"]!.trim();
  const from = process.env["EMAIL_FROM"]!.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Do not echo API key; truncate body
    return {
      sent: false,
      reason: `Resend HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
      provider: "resend",
    };
  }
  const json = (await res.json()) as { id?: string };
  return { sent: true, provider: "resend", id: json.id ?? "unknown" };
}
