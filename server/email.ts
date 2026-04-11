/**
 * Módulo de envio de email usando Resend
 * Configuração: variável de ambiente RESEND_API_KEY
 */
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

let resend: Resend | null = null;

if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log("[Email] Resend configurado com sucesso");
} else {
  console.warn(
    "[Email] RESEND_API_KEY não configurada — envio de email desabilitado"
  );
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!resend) {
    console.warn(
      "[Email] Tentativa de envio ignorada — Resend não configurado"
    );
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "Mundo Da Magia <onboarding@resend.dev>",
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error("[Email] Erro ao enviar:", error);
      return false;
    }

    console.log(
      `[Email] Enviado com sucesso para ${options.to} (ID: ${data?.id})`
    );
    return true;
  } catch (err) {
    console.error("[Email] Erro inesperado:", err);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return resend !== null;
}
