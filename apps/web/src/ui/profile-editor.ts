import { useEffect, useState, type FormEvent } from 'react';
import type { Profile } from '@edutube/contracts/identity';
import { identityService } from '../adapters/http/identity';
import { useAuth } from './auth-context';
export function useProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();
  useEffect(() => {
    const controller = new AbortController();
    identityService
      .profile(controller.signal)
      .then(setProfile)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : 'Profil indisponible.');
        }
      });

    return () => controller.abort();
  }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const schoolLevel = (
        form.has('schoolLevel') ? String(form.get('schoolLevel')) : (profile.schoolLevel ?? '')
      ) as NonNullable<Profile['schoolLevel']> | '';
      const result = await identityService.save({
        displayName: String(form.get('displayName')),
        schoolLevel: schoolLevel || null,
        biography: String(form.get('biography')),
        expectedVersion: profile.version,
      });
      setProfile(result);
      await refresh();
      setMessage('Votre profil est enregistré.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      setMessage((await identityService.requestVerification()).message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };
  const requestPassword = async () => {
    if (!profile) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage((await identityService.forgot(profile.email)).message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };
  return { profile, message, error, busy, save, verify, requestPassword };
}
