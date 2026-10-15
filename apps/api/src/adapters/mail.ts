import nodemailer from 'nodemailer';
import type { Pool } from 'pg';
export function mailDelivery(
  pool: Pool,
  settings: {
    host: string;
    port: number;
    from: string;
    user?: string;
    password?: string;
    requireTLS: boolean;
  },
  report: (error: unknown) => void,
) {
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.requireTLS,
    ...(settings.user ? { auth: { user: settings.user, pass: settings.password } } : {}),
    connectionTimeout: 5000,
    socketTimeout: 10000,
  });
  let running = false;
  let stopped = false;
  const deliver = async () => {
    if (running || stopped) {
      return;
    }
    running = true;
    try {
      const result = await pool.query<{
        id: string;
        recipient: string;
        subject: string;
        content: string;
      }>(
        `UPDATE mail_outbox SET attempts=attempts+1,available_at=now()+interval '1 minute' WHERE id=(SELECT id FROM mail_outbox WHERE sent_at IS NULL AND available_at<=now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,recipient,subject,content`,
      );
      const mail = result.rows[0];
      if (mail) {
        await transport.sendMail({
          from: settings.from,
          to: mail.recipient,
          subject: mail.subject,
          text: mail.content,
        });
        await pool.query("UPDATE mail_outbox SET sent_at=now(),content='' WHERE id=$1", [mail.id]);
      }
    } catch (error) {
      report(error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    void deliver();
  }, 2000);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    while (running) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    transport.close();
  };
}
