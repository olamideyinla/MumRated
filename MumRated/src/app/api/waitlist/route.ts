import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Resend } from "resend";

const resend = new Resend(process.env.AUTH_RESEND_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@mumrated.com";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw: unknown = (body as Record<string, unknown>).email;
  const email =
    typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  // Upsert — re-submissions are silently ignored (update: {} is a no-op)
  await db.waitlistEntry.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  // Send acknowledgement — best-effort, never blocks the 200
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: "You're in — welcome to MumRated!",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F5EDE0;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5EDE0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E0CEB8;">

          <!-- Header -->
          <tr>
            <td style="background:#7B1818;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                MumRated<span style="color:#C9A227;">!</span>
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.65);letter-spacing:0.08em;text-transform:uppercase;">
                Say it. Rate it. Trust it.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;">
              <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#3B2010;line-height:1.3;">
                You&rsquo;re part of the movement. ✓
              </p>
              <p style="margin:0 0 14px;font-size:15px;color:#7A5040;line-height:1.75;">
                Thank you for joining MumRated! We&rsquo;re building Nigeria&rsquo;s most trusted review platform
                for mums — honest, searchable, and mum-led from top to bottom.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#7A5040;line-height:1.75;">
                You&rsquo;ll hear from us as we grow. In the meantime, you can browse reviews, explore
                categories, or write your own review right now.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:30px;background:#7B1818;">
                    <a href="https://mumrated.com/home"
                       style="display:inline-block;padding:13px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:30px;">
                      Browse Reviews →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#FBF6EE;border-top:1px solid #E0CEB8;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#A07860;line-height:1.6;">
                You received this because you signed up at mumrated.com.<br />
                &copy; ${new Date().getFullYear()} MumRated! &middot;
                <a href="https://mumrated.com/privacy" style="color:#7B1818;text-decoration:none;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });
  } catch {
    // Email failure is non-fatal — entry is already saved
  }

  return NextResponse.json({ ok: true });
}
