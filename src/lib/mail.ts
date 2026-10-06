import 'server-only';
import nodemailer from 'nodemailer';
import { env } from './env';

// Envoi d'e-mails via le serveur SMTP du Ministère. Si SMTP_HOST n'est pas configuré,
// les messages sont simplement journalisés (utile en développement et en mode dégradé).
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!env.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(msg: { to: string; subject: string; text: string; html?: string }) {
  const t = getTransporter();
  if (!t) {
    console.info(`[mail:simulé] → ${msg.to} | ${msg.subject}\n${msg.text}`);
    return;
  }
  try {
    await t.sendMail({ from: env.smtpFrom, ...msg });
  } catch (e) {
    console.error('[mail] échec d\'envoi', e);
  }
}
