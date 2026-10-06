import { redirect } from 'next/navigation';
export default function RecherchePage({ searchParams }: { searchParams: { q?: string } }) {
  redirect(`/catalogue${searchParams.q ? `?q=${encodeURIComponent(searchParams.q)}` : ''}`);
}
