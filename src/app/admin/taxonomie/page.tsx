'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast-context';
import { Spinner } from '@/components/ui';
import type { TaxonomyData } from '@/components/forms/TaxonomySelects';

type Kind = 'cycles' | 'classes' | 'disciplines' | 'themes';

// Gestion des référentiels : cycles, classes (rattachées à un cycle), disciplines, thématiques.
export default function TaxonomiePage() {
  const { toast } = useToast();
  const [tax, setTax] = useState<TaxonomyData | null>(null);
  const [form, setForm] = useState<Record<Kind, { code: string; name: string; cycleId?: string; color?: string; order?: string }>>({ cycles: { code: '', name: '' }, classes: { code: '', name: '', cycleId: '' }, disciplines: { code: '', name: '', color: '#0099CC' }, themes: { code: '', name: '' } });
  const load = useCallback(() => api.get<TaxonomyData>('/taxonomy').then(setTax).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const add = async (kind: Kind) => { try { await api.post(`/admin/taxonomy/${kind}`, { ...form[kind], order: form[kind].order ? Number(form[kind].order) : undefined }); toast('Ajouté.', 'success'); setForm({ ...form, [kind]: { ...form[kind], code: '', name: '' } }); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const rename = async (kind: Kind, id: string, current: string) => { const name = prompt('Nouveau libellé :', current); if (!name || name === current) return; try { await api.patch(`/admin/taxonomy/${kind}/${id}`, { name }); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  const remove = async (kind: Kind, id: string) => { if (!confirm('Supprimer cet élément ? (refusé si des contenus y sont rattachés)')) return; try { await api.delete(`/admin/taxonomy/${kind}/${id}`); load(); } catch (e) { toast(errorMessage(e), 'error'); } };
  if (!tax) return <Spinner />;
  const Row = ({ kind, id, code, name, extra }: { kind: Kind; id: string; code: string; name: string; extra?: React.ReactNode }) => <li className="flex items-center gap-2 py-1.5 text-sm"><span className="w-24 font-mono text-xs text-simen-gray-mid">{code}</span><span className="flex-1">{name}</span>{extra}<button type="button" className="text-xs text-simen-blue hover:underline" onClick={() => rename(kind, id, name)}>Renommer</button><button type="button" className="text-xs text-sn-red hover:underline" onClick={() => remove(kind, id)}>Supprimer</button></li>;
  const AddForm = ({ kind, children }: { kind: Kind; children?: React.ReactNode }) => (
    <form onSubmit={(e) => { e.preventDefault(); add(kind); }} className="mt-3 flex flex-wrap gap-2 border-t border-simen-gray-lighter pt-3">
      <input value={form[kind].code} onChange={(e) => setForm({ ...form, [kind]: { ...form[kind], code: e.target.value.toUpperCase() } })} className="input w-28" placeholder="CODE" aria-label="Code" required pattern="[A-Z0-9_\-]+" />
      <input value={form[kind].name} onChange={(e) => setForm({ ...form, [kind]: { ...form[kind], name: e.target.value } })} className="input flex-1" placeholder="Libellé" aria-label="Libellé" required />
      {children}
      <button type="submit" className="btn-primary">Ajouter</button>
    </form>
  );
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cycles, classes, disciplines et thématiques</h1>
      <p className="text-sm text-simen-gray">Référentiels du système éducatif sénégalais. Un élément rattaché à des contenus ne peut pas être supprimé.</p>
      <section className="card p-5"><h2 className="font-bold">Cycles et classes</h2>
        {tax.cycles.map((c) => <div key={c.id} className="mt-3"><div className="flex items-center gap-2"><h3 className="font-semibold text-simen-blue">{c.name} <span className="font-mono text-xs text-simen-gray-mid">{c.code}</span></h3><button type="button" className="text-xs text-simen-blue hover:underline" onClick={() => rename('cycles', c.id, c.name)}>Renommer</button></div><ul className="ml-4 divide-y divide-simen-gray-lighter">{c.classes.map((cl) => <Row key={cl.id} kind="classes" id={cl.id} code={cl.code} name={cl.name} />)}</ul></div>)}
        <AddForm kind="classes"><select value={form.classes.cycleId} onChange={(e) => setForm({ ...form, classes: { ...form.classes, cycleId: e.target.value } })} className="input w-auto" aria-label="Cycle" required><option value="">Cycle…</option>{tax.cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input type="number" value={form.classes.order ?? ''} onChange={(e) => setForm({ ...form, classes: { ...form.classes, order: e.target.value } })} className="input w-20" placeholder="Ordre" aria-label="Ordre" /></AddForm>
        <AddForm kind="cycles"><input type="number" value={form.cycles.order ?? ''} onChange={(e) => setForm({ ...form, cycles: { ...form.cycles, order: e.target.value } })} className="input w-20" placeholder="Ordre" aria-label="Ordre" /></AddForm>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="font-bold">Disciplines</h2><ul className="divide-y divide-simen-gray-lighter">{tax.disciplines.map((d) => <Row key={d.id} kind="disciplines" id={d.id} code={d.code} name={d.name} extra={<span className="h-4 w-4 rounded" style={{ backgroundColor: (d as { color?: string }).color }} aria-hidden="true" />} />)}</ul><AddForm kind="disciplines"><input type="color" value={form.disciplines.color} onChange={(e) => setForm({ ...form, disciplines: { ...form.disciplines, color: e.target.value } })} aria-label="Couleur" className="h-10 w-12 rounded border" /></AddForm></section>
        <section className="card p-5"><h2 className="font-bold">Thématiques transversales</h2><ul className="divide-y divide-simen-gray-lighter">{tax.themes.map((t) => <Row key={t.id} kind="themes" id={t.id} code={t.code} name={t.name} />)}</ul><AddForm kind="themes" /></section>
      </div>
    </div>
  );
}
