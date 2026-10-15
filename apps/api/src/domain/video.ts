export type VideoStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'REMOVED';
export interface VideoRecord {
  id: string;
  courseId: string;
  lessonId: string;
  fileName: string;
  sizeBytes: number;
  status: VideoStatus;
  durationSeconds: number | null;
  errorMessage: string | null;
  storageDriver: string;
  sourceKey: string;
  requestHash: string;
}
export interface VideoAsset {
  name: string;
  storageKey: string;
  mediaType: string;
  sizeBytes: number;
}
