import { handler, ok } from '@/lib/api';
import { getTaxonomy } from '@/lib/media';

export const dynamic = 'force-dynamic';

// GET /api/v1/taxonomy — cycles (avec classes), disciplines, thématiques
export const GET = handler(async () => ok(await getTaxonomy()));
