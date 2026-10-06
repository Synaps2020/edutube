import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Sonde de santé (utilisée par docker-compose healthcheck et le monitoring).
export async function GET() {
  try {
    const [queued, running, failed] = await Promise.all([
      prisma.job.count({ where: { status: 'QUEUED' } }),
      prisma.job.count({ where: { status: 'RUNNING' } }),
      prisma.job.count({ where: { status: 'FAILED' } }),
    ]);
    return NextResponse.json({ status: 'ok', database: 'ok', jobs: { queued, running, failed }, time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ status: 'degraded', database: 'error', message: (e as Error).message }, { status: 503 });
  }
}
