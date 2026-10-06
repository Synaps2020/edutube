import { PlaylistView } from '@/components/media/PlaylistView';
export default function ListePage({ params }: { params: { id: string } }) { return <PlaylistView id={params.id} />; }
