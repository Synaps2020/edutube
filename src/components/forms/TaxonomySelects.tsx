'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { Field } from '@/components/ui';

export interface TaxonomyData { cycles: Array<{ id: string; code: string; name: string; classes: Array<{ id: string; code: string; name: string }> }>; disciplines: Array<{ id: string; code: string; name: string }>; themes: Array<{ id: string; code: string; name: string }> }

export function useTaxonomy() {
  const [tax, setTax] = useState<TaxonomyData | null>(null);
  useEffect(() => { api.get<TaxonomyData>('/taxonomy').then(setTax).catch(() => {}); }, []);
  return tax;
}

interface Values { cycleId: string; classLevelId: string; disciplineId: string; themeId: string }

// Sélecteurs cycle → classe (dépendants), discipline, thématique, partagés par les formulaires d'upload et de proposition.
export function TaxonomySelects({ values, onChange, errors, taxonomy }: { values: Values; onChange: (v: Partial<Values>) => void; errors?: Record<string, string[]>; taxonomy: TaxonomyData | null }) {
  const cycle = taxonomy?.cycles.find((c) => c.id === values.cycleId);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Cycle" htmlFor="cycleId" required error={errors?.cycleId?.[0]}>
        <select id="cycleId" value={values.cycleId} onChange={(e) => onChange({ cycleId: e.target.value, classLevelId: '' })} className="input" required>
          <option value="">Choisir un cycle…</option>
          {taxonomy?.cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Classe" htmlFor="classLevelId" required error={errors?.classLevelId?.[0]}>
        <select id="classLevelId" value={values.classLevelId} onChange={(e) => onChange({ classLevelId: e.target.value })} className="input" required disabled={!cycle}>
          <option value="">{cycle ? 'Choisir une classe…' : 'Choisissez d’abord un cycle'}</option>
          {cycle?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Discipline" htmlFor="disciplineId" required error={errors?.disciplineId?.[0]}>
        <select id="disciplineId" value={values.disciplineId} onChange={(e) => onChange({ disciplineId: e.target.value })} className="input" required>
          <option value="">Choisir…</option>
          {taxonomy?.disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Thématique transversale" htmlFor="themeId" required error={errors?.themeId?.[0]}>
        <select id="themeId" value={values.themeId} onChange={(e) => onChange({ themeId: e.target.value })} className="input" required>
          <option value="">Choisir…</option>
          {taxonomy?.themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
    </div>
  );
}
