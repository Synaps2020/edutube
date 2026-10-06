import 'server-only';
import { prisma } from './db';
import type { Prisma } from '@prisma/client';

// Journal d'audit des actions sensibles (administration, modération, authentification).
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
        ip: params.ip,
        userAgent: params.userAgent?.slice(0, 300),
      },
    });
  } catch (e) {
    // Le journal ne doit jamais faire échouer l'action métier.
    console.error('[audit] échec d\'écriture', e);
  }
}

export async function moderationDecision(params: {
  moderatorId: string;
  targetType: 'MEDIA' | 'SUBMISSION' | 'COMMENT' | 'REPORT' | 'USER';
  targetId: string;
  action: string;
  reason?: string | null;
}) {
  await prisma.moderationDecision.create({ data: { ...params, reason: params.reason ?? null } });
}
