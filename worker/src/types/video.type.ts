export const VideoQueueName = "Video-processing";

export enum VideoEditType{
  EXTRACT_AUDIO = "extract-audio",
  RESIZE_VIDEO = "resize",
} 

export enum JobStatus {
  UPLOADED = "UPLOADED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  QUEUE_FAILED="QUEUE_FAILED"
}