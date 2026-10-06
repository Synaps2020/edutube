import { handler, ok } from '@/lib/api';
import { suggest } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/search/suggest?q= — suggestions d'autocomplétion
export const GET = handler(async (req) => {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  return ok(await suggest(q));
});
