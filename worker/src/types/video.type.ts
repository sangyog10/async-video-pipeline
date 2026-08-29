export const VideoQueueName = "Video-processing";

export enum VideoEditType {
  EXTRACT_AUDIO = "extract-audio",
  RESIZE_VIDEO = "resize",
  COMPRESS_VIDEO = "compress",
  CREATE_THUMBNAIL = "create-thumbnail",
  TRIM_VIDEO = "trim",
  CREATE_GIF = "create-gif",
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