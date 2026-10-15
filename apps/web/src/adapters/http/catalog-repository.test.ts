import { beforeEach, expect, it, vi } from 'vitest';
const services = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock('./runtime', () => ({ api: { paths: services } }));
import { httpCatalog } from './catalog-repository';

beforeEach(() => vi.resetAllMocks());
it('charge tous les parcours du serveur, au-delà de la première page', async () => {
  services.list.mockImplementation(async ({ page }: { page: number }) => ({
    items: [{ id: `parcours-${page}` }],
    pagination: { page, pageSize: 100, total: 101, totalPages: 2 },
  }));
  services.get.mockImplementation(async (id: string) => ({
    id,
    title: id,
    description: 'Parcours renvoyé par le serveur.',
    steps: [{ course: { id: 'cours-serveur' } }],
    durationMinutes: 90,
  }));
  const paths = await httpCatalog.getPaths();
  expect(paths.map((path) => path.id)).toEqual(['parcours-1', 'parcours-2']);
  expect(services.list).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 100 });
  expect(paths[1]?.courseIds).toEqual(['cours-serveur']);
});
it('signale une panne du serveur sans inventer de parcours de remplacement', async () => {
  services.list.mockRejectedValue(new Error('Serveur indisponible.'));
  await expect(httpCatalog.getPaths()).rejects.toThrow('Serveur indisponible.');
});
