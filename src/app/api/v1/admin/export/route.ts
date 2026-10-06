import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handler, badRequest } from '@/lib/api';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function csv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Séparateur ';' (convention francophone, ouverture directe dans Excel/LibreOffice) + BOM UTF-8
  return '﻿' + [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\r\n');
}

// GET /api/v1/admin/export?type=media|users|views|submissions|audit — export CSV
export const GET = handler(async (req) => {
  const admin = await requireRole('ADMIN');
  const type = req.nextUrl.searchParams.get('type') ?? 'media';
  let rows: Array<Record<string, unknown>> = [];
  if (type === 'media') {
    const m = await prisma.media.findMany({ include: { cycle: true, classLevel: true, discipline: true, theme: true, channel: true, uploader: true }, orderBy: { createdAt: 'desc' } });
    rows = m.map((x) => ({ id: x.id, titre: x.title, type: x.type, statut: x.status, cycle: x.cycle.name, classe: x.classLevel.code, discipline: x.discipline.name, thematique: x.theme.name, chapitre: x.chapter, langue: x.language, niveau: x.difficulty, duree_s: x.durationSec, vues: x.viewCount, jaime: x.likeCount, commentaires: x.commentCount, chaine: x.channel.name, auteur_pedagogique: x.pedagogicalAuthor, televerseur: x.uploader.email, licence: x.license, publie_le: x.publishedAt, cree_le: x.createdAt }));
  } else if (type === 'users') {
    const u = await prisma.user.findMany({ include: { classLevel: true }, orderBy: { createdAt: 'desc' } });
    rows = u.map((x) => ({ id: x.id, email: x.email, prenom: x.firstName, nom: x.lastName, role: x.role, statut: x.status, classe: x.classLevel?.code ?? '', etablissement: x.establishment, region: x.region, ief: x.ief, ia: x.ia, cree_le: x.createdAt, derniere_connexion: x.lastLoginAt }));
  } else if (type === 'views') {
    const v = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT date_trunc('day', v."createdAt")::date AS jour, m.title AS titre, m.type, COUNT(*)::int AS vues FROM "ViewEvent" v JOIN "Media" m ON m.id = v."mediaId" GROUP BY 1, 2, 3 ORDER BY 1 DESC, 4 DESC LIMIT 20000`;
    rows = v;
  } else if (type === 'submissions') {
    const s = await prisma.submission.findMany({ include: { author: true, classLevel: true, discipline: true, reviewer: true }, orderBy: { createdAt: 'desc' } });
    rows = s.map((x) => ({ id: x.id, titre: x.title, type: x.type, statut: x.status, auteur: x.author.email, role_auteur: x.author.role, classe: x.classLevel.code, discipline: x.discipline.name, relecteur: x.reviewer?.email ?? '', retour: x.reviewNote, cree_le: x.createdAt, traite_le: x.reviewedAt }));
  } else if (type === 'audit') {
    const a = await prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: 'desc' }, take: 20000 });
    rows = a.map((x) => ({ date: x.createdAt, acteur: x.actor?.email ?? '', action: x.action, entite: x.entity, entite_id: x.entityId, ip: x.ip, details: x.details ? JSON.stringify(x.details) : '' }));
  } else {
    throw badRequest('Type d’export inconnu (media, users, views, submissions, audit).');
  }
  await audit({ actorId: admin.id, action: 'EXPORT_CSV', details: { type, rows: rows.length } });
  return new NextResponse(csv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="export-${type}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}, { csrf: false });
