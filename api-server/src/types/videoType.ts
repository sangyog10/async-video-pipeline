export interface Video {
  id: number; 
  title: string;
  client_job_id: string;
  original_bucket: string;
  original_object_key: string;
  etag?: string | null;
  created_at: Date;
}