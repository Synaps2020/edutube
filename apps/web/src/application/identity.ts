import type { Profile, ProfileInput } from '@edutube/contracts/identity';
export interface IdentityAccess {
  profile(signal?: AbortSignal): Promise<Profile>;
  save(input: ProfileInput): Promise<Profile>;
  requestVerification(): Promise<{ message: string }>;
  verify(token: string): Promise<{ message: string }>;
  forgot(email: string): Promise<{ message: string }>;
  reset(token: string, password: string): Promise<{ message: string }>;
}
