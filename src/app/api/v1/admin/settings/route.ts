import { prisma } from '@/lib/db';
import { handler, ok, parseJson } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { settingsSchema } from '@/lib/validation';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/settings — paramètres (quotas, limites, annonce)
export const GET = handler(async () => {
  await requireRole('ADMIN');
  const rows = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  return ok(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

// PATCH /api/v1/admin/settings — { clé: valeur, … }
export const PATCH = handler(async (req) => {
  const admin = await requireRole('ADMIN');
  const data = await parseJson(req, settingsSchema);
  for (const [key, value] of Object.entries(data)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await audit({ actorId: admin.id, action: 'SETTINGS_UPDATE', details: { keys: Object.keys(data) } });
  const rows = await prisma.setting.findMany();
  return ok(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});
