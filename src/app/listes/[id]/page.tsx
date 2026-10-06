import type { Metadata } from 'next';
import { PlaylistView } from '@/components/media/PlaylistView';
export const metadata: Metadata = { title: 'Liste de lecture' };
export default function ListePubliquePage({ params }: { params: { id: string } }) { return <PlaylistView id={params.id} />; }
