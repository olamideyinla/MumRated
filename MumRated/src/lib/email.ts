/**
 * Thin wrapper around the Resend REST API.
 * Best-effort: never throws — logs errors and returns false on failure.
 * Used for admin-notification emails only; product emails go through Auth.js.
 */

const RESEND_API_KEY = process.env.AUTH_RESEND_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "noreply@mumrated.com";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[email] AUTH_RESEND_KEY not set — skipping email send");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] Resend error ${res.status}: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return false;
  }
}
