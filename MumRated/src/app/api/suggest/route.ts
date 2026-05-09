import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";
import type { ListingType } from "@prisma/client";

const resend = new Resend(process.env.AUTH_RESEND_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@mumrated.com";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL ?? process.env.EMAIL_FROM ?? "hello@mumrated.com";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  const type = b.type === "PRODUCT" || b.type === "SERVICE" ? (b.type as ListingType) : null;
  const categoryHint = typeof b.categoryHint === "string" ? b.categoryHint.trim() || null : null;
  const description = typeof b.description === "string" ? b.description.trim() || null : null;
  const submitterEmail =
    typeof b.submitterEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.submitterEmail.trim())
      ? b.submitterEmail.trim().toLowerCase()
      : null;

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Please enter a name for the listing." }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: "Please choose a type (Product or Service)." }, { status: 400 });
  }

  const suggestion = await db.listingSuggestion.create({
    data: { name, type, categoryHint, description, submitterEmail },
  });

  // Notify admin — best-effort, never blocks the 201
  try {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `New listing suggestion: ${name}`,
      html: `
<p><strong>Name:</strong> ${name}<br>
<strong>Type:</strong> ${type}<br>
${categoryHint ? `<strong>Category hint:</strong> ${categoryHint}<br>` : ""}
${description ? `<strong>Description:</strong> ${description}<br>` : ""}
${submitterEmail ? `<strong>Submitter email:</strong> ${submitterEmail}` : ""}</p>
<p>ID: ${suggestion.id}</p>
      `.trim(),
    });
  } catch {
    // Non-fatal — suggestion already saved
  }

  // Acknowledge submitter if they left an email
  if (submitterEmail) {
    try {
      await resend.emails.send({
        from: FROM,
        to: submitterEmail,
        subject: "We got your suggestion — thanks!",
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#F5EDE0;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5EDE0;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E0CEB8;">
        <tr>
          <td style="background:#7B1818;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">MumRated<span style="color:#C9A227;">!</span></p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 32px;">
            <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#3B2010;line-height:1.3;">Thanks for your suggestion! ✓</p>
            <p style="margin:0 0 14px;font-size:15px;color:#7A5040;line-height:1.75;">We've received your suggestion for <strong>${name}</strong> and our team will review it within 48 hours.</p>
            <p style="margin:0 0 28px;font-size:15px;color:#7A5040;line-height:1.75;">Once it's added, we'll drop you a note so you can be the first to leave a review.</p>
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="border-radius:30px;background:#7B1818;">
                <a href="https://mumrated.com/browse" style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:30px;">Browse listings →</a>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#FBF6EE;border-top:1px solid #E0CEB8;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#A07860;line-height:1.6;">
              &copy; ${new Date().getFullYear()} MumRated! &middot;
              <a href="https://mumrated.com/privacy" style="color:#7B1818;text-decoration:none;">Privacy Policy</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `.trim(),
      });
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
