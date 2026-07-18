import { Resend } from "resend";
import { env } from "./env.js";

// Single shared Resend client instance.
// If RESEND_API_KEY is absent (dev without email configured), we create the
// client with a placeholder key — send() calls will fail gracefully and the
// email service layer handles the fallback with a console.log.
export const resend = new Resend(env.RESEND_API_KEY ?? "re_placeholder_not_configured");

export const FROM_EMAIL = env.FROM_EMAIL;
