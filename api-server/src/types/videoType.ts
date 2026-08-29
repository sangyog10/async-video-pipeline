export interface Video {
  id: number;
  title: string;
  client_job_id: string;
  original_bucket: string;
  original_object_key: string;
  etag?: string | null;
  created_at: Date;
  status?: JobStatus;
  processed_object_key?: string | null;
  processed_bucket?: string | null;
  progress?: number;
  job_type?: string | null;
  job_params?: Record<string, unknown> | null;
}


export const VideoQueueName = "Video-processing"


export enum VideoEditType {
  EXTRACT_AUDIO = "extract-audio",
  RESIZE_VIDEO = "resize",
  COMPRESS_VIDEO = "compress",
  CREATE_THUMBNAIL = "create-thumbnail",
  DELETE_VIDEO = "delete-video"
}

export enum JobStatus {
  UPLOADED = "UPLOADED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  QUEUE_FAILED = "QUEUE_FAILED",
  DELETED = "DELETED"
}

