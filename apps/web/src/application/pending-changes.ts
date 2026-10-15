const writers = new Set<() => Promise<void>>();
export function registerPendingChanges(flush: () => Promise<void>) {
  writers.add(flush);
  return () => {
    writers.delete(flush);
  };
}
export async function flushPendingChanges() {
  await Promise.all([...writers].map((flush) => flush()));
}
