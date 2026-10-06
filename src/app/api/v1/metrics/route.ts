import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Métriques au format Prometheus (texte). Protégées par METRICS_TOKEN (en-tête Authorization: Bearer …)
// ou restreintes au réseau interne par Nginx.
export async function GET(req: NextRequest) {
  if (env.metricsToken) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${env.metricsToken}`) return new NextResponse('unauthorized', { status: 401 });
  }
  const since24h = new Date(Date.now() - 86400000);
  const [users, mediaByStatus, jobsByStatus, views24h, submissionsPending, reportsOpen] = await Promise.all([
    prisma.user.count(),
    prisma.media.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.viewEvent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.submission.count({ where: { status: 'PENDING' } }),
    prisma.report.count({ where: { status: 'OPEN' } }),
  ]);
  const lines: string[] = [
    '# HELP edu_users_total Nombre total d’utilisateurs',
    '# TYPE edu_users_total gauge',
    `edu_users_total ${users}`,
    '# HELP edu_media_total Médias par statut',
    '# TYPE edu_media_total gauge',
    ...mediaByStatus.map((m) => `edu_media_total{status="${m.status}"} ${m._count._all}`),
    '# HELP edu_jobs_total Jobs de traitement par statut',
    '# TYPE edu_jobs_total gauge',
    ...jobsByStatus.map((j) => `edu_jobs_total{status="${j.status}"} ${j._count._all}`),
    '# HELP edu_views_24h Vues enregistrées sur 24 h',
    '# TYPE edu_views_24h gauge',
    `edu_views_24h ${views24h}`,
    '# HELP edu_submissions_pending Propositions en attente',
    '# TYPE edu_submissions_pending gauge',
    `edu_submissions_pending ${submissionsPending}`,
    '# HELP edu_reports_open Signalements ouverts',
    '# TYPE edu_reports_open gauge',
    `edu_reports_open ${reportsOpen}`,
    '# HELP process_uptime_seconds Durée de fonctionnement du processus',
    '# TYPE process_uptime_seconds gauge',
    `process_uptime_seconds ${Math.round(process.uptime())}`,
  ];
  return new NextResponse(lines.join('\n') + '\n', { headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' } });
}
