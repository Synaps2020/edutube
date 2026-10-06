import { handler, noContent } from '@/lib/api';
import { clearSessionCookie, getCurrentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

// POST /api/v1/auth/logout
export const POST = handler(async () => {
  const user = await getCurrentUser();
  await clearSessionCookie();
  if (user) await audit({ actorId: user.id, action: 'USER_LOGOUT' });
  return noContent();
});
