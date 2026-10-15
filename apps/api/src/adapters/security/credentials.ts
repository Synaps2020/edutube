import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher, TokenGenerator } from '../../application/ports';
const derive = promisify(scrypt);
export const passwords: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16).toString('hex');
    const key = (await derive(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${key.toString('hex')}`;
  },
  async verify(password, hash) {
    const [algorithm, salt, stored] = hash.split(':');
    if (algorithm !== 'scrypt' || !salt || !stored) {
      return false;
    }
    const expected = Buffer.from(stored, 'hex');
    const actual = (await derive(password, salt, 64)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  },
};
export const tokens: TokenGenerator = {
  create: () => randomBytes(32).toString('hex'),
  digest: (token) => createHash('sha256').update(token).digest('hex'),
};
