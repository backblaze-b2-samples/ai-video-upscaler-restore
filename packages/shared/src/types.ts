export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Restoration Job (primary entity) ---

export type JobSourceType = "image" | "video";
export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobScale = 4 | 8;

export interface RestorationJob {
  id: string;
  name: string;
  source_key: string;
  source_type: JobSourceType;
  scale: JobScale;
  face_restore: boolean;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  source_bytes: number;
  source_width: number;
  source_height: number;
  output_key: string | null;
  output_bytes: number;
  output_width: number;
  output_height: number;
  growth_multiplier: number;
  frames_total: number;
  frames_done: number;
  faces_restored: number;
  error: string | null;
}

export interface JobCreate {
  name: string;
  source_key: string;
  scale: JobScale;
  face_restore: boolean;
}

export interface JobUpdate {
  name?: string;
  source_key?: string;
  scale?: JobScale;
  face_restore?: boolean;
}

export interface JobDetail {
  job: RestorationJob;
  source_url: string;
  output_url: string | null;
}

export interface RestorationItem {
  id: string;
  name: string;
  source_type: JobSourceType;
  source_url: string;
  output_url: string;
  source_bytes: number;
  output_bytes: number;
  growth_multiplier: number;
}

export interface JobStats {
  jobs_total: number;
  jobs_by_status: Record<string, number>;
  sources_count: number;
  sources_bytes: number;
  sources_bytes_human: string;
  restored_count: number;
  restored_bytes: number;
  restored_bytes_human: string;
  output_footprint_growth: number;
  faces_restored: number;
}
