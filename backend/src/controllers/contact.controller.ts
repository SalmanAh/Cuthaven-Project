import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";
import { resend, FROM_EMAIL } from "../config/resend.js";

const contactSchema = z.object({
  name:    z.string().min(1).max(120),
  email:   z.string().email().max(254),
  phone:   z.string().max(30).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().min(5).max(5000),
});

// ─── POST /api/contact ─────────────────────────────────────────────────────
export async function submitContact(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { name, email, phone, subject, message } = parsed.data;

    // Write to contact_submissions table
    // Schema: name, email, phone, subject, message, status, created_at
    const { error: dbErr } = await supabaseAdmin
      .from("contact_submissions")
      .insert({
        name,
        email,
        phone:   phone   ?? null,
        subject: subject ?? null,
        message,
        status: "new",
        created_at: new Date().toISOString(),
      });

    if (dbErr) throw dbErr;

    // Send notification email to support — best-effort, never fail the response
    if (env.RESEND_API_KEY) {
      resend.emails.send({
        from: FROM_EMAIL,
        to:   "support@cuthaven.com",
        replyTo: email,
        subject: `New contact form: ${subject ?? "(no subject)"} — from ${name}`,
        text: `New contact submission\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone ?? "—"}\nSubject: ${subject ?? "—"}\n\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone ?? "—"}</p><p><strong>Subject:</strong> ${subject ?? "—"}</p><hr/><p style="white-space:pre-wrap">${message}</p>`,
      }).catch((err: unknown) => {
        console.error("[CONTACT] Failed to send notification email:", err);
      });
    }

    return res.status(201).json({ message: "Message received. We'll be in touch within 24 hours." });
  } catch (err) {
    next(err);
  }
}
