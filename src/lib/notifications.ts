import 'server-only';
import type { NotificationType } from '@prisma/client';
import { prisma } from './db';
import { sendMail } from './mail';

// Notification interne (cloche) + e-mail optionnel.
export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
}) {
  await prisma.notification.create({
    data: { userId: params.userId, type: params.type, title: params.title, body: params.body, link: params.link },
  });
  if (params.email) {
    const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { email: true, firstName: true } });
    if (user) {
      await sendMail({
        to: user.email,
        subject: `[EduTube] ${params.title}`,
        text: `Bonjour ${user.firstName},\n\n${params.body ?? params.title}\n\n${params.link ? `Lien : ${params.link}\n\n` : ''}Ministère de l'Éducation nationale — Plateforme EduTube`,
      });
    }
  }
}

// Notifie tous les administrateurs (ex. nouvelle proposition, nouveau signalement).
export async function notifyAdmins(params: { type: NotificationType; title: string; body?: string; link?: string }) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, type: params.type, title: params.title, body: params.body, link: params.link })),
  });
}
