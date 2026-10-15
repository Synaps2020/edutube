import type { NoteDto } from '@edutube/contracts';
import type { NotePort } from './api/ports';
export type NoteStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
interface NoteEvents {
  status(lessonId: string, status: NoteStatus, message?: string): void;
  saved(note: NoteDto): void;
}
export class NoteWriter {
  private versions = new Map<string, number | null>();
  private stored = new Map<string, string>();
  private pending = new Map<string, string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private jobs = new Map<string, Promise<void>>();
  private blocked = new Set<string>();
  private controller = new AbortController();
  constructor(
    private notes: NotePort,
    private events: NoteEvents,
    private delay = 600,
  ) {}
  restore(lessonId: string, note: NoteDto | null) {
    if (this.dirty(lessonId)) {
      return;
    }
    this.versions.set(lessonId, note?.version ?? null);
    this.stored.set(lessonId, note?.text ?? '');
  }
  dirty(lessonId: string) {
    return this.pending.has(lessonId) || this.jobs.has(lessonId);
  }
  hasPending() {
    return this.pending.size > 0 || this.jobs.size > 0;
  }
  change(lessonId: string, text: string) {
    if (this.controller.signal.aborted) {
      return;
    }
    this.pending.set(lessonId, text);
    clearTimeout(this.timers.get(lessonId));
    if (this.blocked.has(lessonId)) {
      return;
    }
    this.events.status(lessonId, 'pending');
    this.timers.set(
      lessonId,
      setTimeout(() => {
        void this.flush(lessonId).catch(() => undefined);
      }, this.delay),
    );
  }
  flush(lessonId: string): Promise<void> {
    clearTimeout(this.timers.get(lessonId));
    this.timers.delete(lessonId);
    if (this.controller.signal.aborted) {
      return Promise.resolve();
    }
    const running = this.jobs.get(lessonId);
    if (running) {
      return running.then(() => this.flush(lessonId));
    }
    if (this.blocked.has(lessonId)) {
      return Promise.reject(new Error('Une note attend votre décision avant enregistrement.'));
    }
    const text = this.pending.get(lessonId);
    if (text === undefined) {
      return Promise.resolve();
    }
    if (!this.versions.has(lessonId)) {
      return Promise.reject(new Error('La note n’a pas encore été chargée.'));
    }
    this.pending.delete(lessonId);
    if (text === this.stored.get(lessonId)) {
      this.events.status(lessonId, 'saved');
      return Promise.resolve();
    }
    this.events.status(lessonId, 'saving');
    const job = Promise.resolve()
      .then(() =>
        this.notes.save(
          lessonId,
          { text, expectedVersion: this.versions.get(lessonId) ?? null },
          { signal: this.controller.signal },
        ),
      )
      .then((note) => {
        if (this.controller.signal.aborted) {
          return;
        }
        this.versions.set(lessonId, note.version);
        this.stored.set(lessonId, note.text);
        this.events.saved(note);
        if (!this.pending.has(lessonId)) {
          this.events.status(lessonId, 'saved');
        }
      })
      .catch((failure: unknown) => {
        if (this.controller.signal.aborted) {
          return;
        }
        if (!this.pending.has(lessonId)) {
          this.pending.set(lessonId, text);
        }
        this.blocked.add(lessonId);
        const conflict =
          typeof failure === 'object' &&
          failure !== null &&
          'code' in failure &&
          failure.code === 'REVISION_CONFLICT';
        this.events.status(
          lessonId,
          conflict ? 'conflict' : 'error',
          failure instanceof Error ? failure.message : 'Enregistrement impossible.',
        );
        throw failure;
      })
      .finally(() => {
        this.jobs.delete(lessonId);
      });
    this.jobs.set(lessonId, job);
    return job.then(() => (this.pending.has(lessonId) ? this.flush(lessonId) : undefined));
  }
  async retry(lessonId: string) {
    this.blocked.delete(lessonId);
    await this.flush(lessonId);
  }
  replace(lessonId: string, note: NoteDto | null) {
    this.pending.delete(lessonId);
    this.blocked.delete(lessonId);
    clearTimeout(this.timers.get(lessonId));
    this.restore(lessonId, note);
    this.events.status(lessonId, 'saved');
  }
  async keepDraft(lessonId: string, note: NoteDto | null) {
    this.versions.set(lessonId, note?.version ?? null);
    this.stored.set(lessonId, note?.text ?? '');
    await this.retry(lessonId);
  }
  async flushAll() {
    await Promise.all(
      [...new Set([...this.pending.keys(), ...this.jobs.keys()])].map((id) => this.flush(id)),
    );
  }
  dispose() {
    this.controller.abort();
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pending.clear();
  }
}
