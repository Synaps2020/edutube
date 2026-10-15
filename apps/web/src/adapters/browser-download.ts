import type { ResourceDto } from '@edutube/contracts';
import { api } from './http/runtime';
export async function downloadDocument(resource: ResourceDto) {
  const download = await api.lessons.download(resource.id, resource.fileName);
  const address = URL.createObjectURL(download.blob);
  const link = document.createElement('a');
  link.href = address;
  link.download = download.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(address), 1000);
}
