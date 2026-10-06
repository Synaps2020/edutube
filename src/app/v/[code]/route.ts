import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Lien court /v/:code → page du média
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const media = await prisma.media.findFirst({ where: { OR: [{ shortCode: params.code }, { shortCode: params.code.trim() }] }, select: { slug: true } });
  const url = new URL(media ? `/media/${media.slug}` : `/catalogue?code=introuvable`, req.url);
  return NextResponse.redirect(url, 302);
}
