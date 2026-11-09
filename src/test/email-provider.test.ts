import { describe, expect, test } from "bun:test";

import { emailProviderStatus, sendEmail } from "../lib/email/provider";

describe("emailProviderStatus", () => {
  test("disabled when env unset", () => {
    const prevP = process.env["EMAIL_PROVIDER"];
    const prevK = process.env["RESEND_API_KEY"];
    const prevF = process.env["EMAIL_FROM"];
    delete process.env["EMAIL_PROVIDER"];
    delete process.env["RESEND_API_KEY"];
    delete process.env["EMAIL_FROM"];
    const s = emailProviderStatus();
    expect(s.enabled).toBe(false);
    expect(s.provider).toBe("none");
    if (prevP !== undefined) process.env["EMAIL_PROVIDER"] = prevP;
    else delete process.env["EMAIL_PROVIDER"];
    if (prevK !== undefined) process.env["RESEND_API_KEY"] = prevK;
    else delete process.env["RESEND_API_KEY"];
    if (prevF !== undefined) process.env["EMAIL_FROM"] = prevF;
    else delete process.env["EMAIL_FROM"];
  });

  test("sendEmail no-ops without config", async () => {
    const prevP = process.env["EMAIL_PROVIDER"];
    delete process.env["EMAIL_PROVIDER"];
    const r = await sendEmail({ to: "a@b.co", subject: "t", text: "x" });
    expect(r.sent).toBe(false);
    if (prevP !== undefined) process.env["EMAIL_PROVIDER"] = prevP;
    else delete process.env["EMAIL_PROVIDER"];
  });
});
