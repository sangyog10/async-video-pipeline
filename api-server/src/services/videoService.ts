import db from "../db/database.js"
import { deleteVideoFromAws, getPresignedDownloadUrl, uploadVideoToAws } from "../config/aws.config.js"
import { VideoBucket } from "../types/bucketName.js";
import { JobStatus, Video, VideoEditType } from "../types/videoType.js";
import { videoProcessingQueue } from "../config/queue.config.js";


export class VideoService {

  /**
   * 1. Upload video to AWS, if it fails return error
   * 2. Upload metadata to postgres, if it failes, delete video and return error
   * 3. Upload video ID to queue and set status to uploaded, if it fails, set status to failed and apply cron job
   */

  async uploadVideo(file: Express.Multer.File, clientId: string): Promise<Video> {
    const key = `${Date.now()}-${file.originalname}`;
    const title = file.originalname;
    const bucketName = VideoBucket;

    try {
      //upload video to minio
      const metadata = await uploadVideoToAws(bucketName, key, file.buffer, file.mimetype)
      if (!metadata.ETag) {
        throw new Error("Failed to upload to Minio/s3")
      }

      //upload video info to database
      const sql = `
      INSERT INTO Video(title, client_job_id, original_bucket, original_object_key)
      VALUES($1, $2, $3, $4)
      RETURNING *
    `;

      const params = [title, clientId, bucketName, key];

      const videoRecord = await db.queryOne<Video>(sql, params)

      if (!videoRecord) {
        await deleteVideoFromAws(bucketName, key)
        throw new Error("Failed to save details to database, sucessfully deleted the video");
      }

      return videoRecord;
    } catch (error) {
      console.error("Rollback triggered. Deleting orphaned S3 object:", key);
      await deleteVideoFromAws(bucketName, key)
      throw error;
    }
  }

  async registerVideo(metadata: {
    title: string;
    clientId: string;
    bucketName: string;
    key: string;
  }): Promise<Video> {
    const { title, clientId, bucketName, key } = metadata;

    const sql = `
      INSERT INTO Video(title, client_job_id, original_bucket, original_object_key)
      VALUES($1, $2, $3, $4)
      RETURNING *
    `;

    const params = [title, clientId, bucketName, key];

    const videoRecord = await db.queryOne<Video>(sql, params);

    if (!videoRecord) {
      throw new Error("Failed to save details to database");
    }

    return videoRecord;
  }

  /**
   * Persist job metadata, enqueue the job, and update the status accordingly.
   * If enqueueing fails, the video is marked QUEUE_FAILED and the stored
   * metadata lets the scheduler re-attempt the enqueue later.
   */
  async enqueueVideoJob(
    video: Video,
    type: VideoEditType,
    data: Record<string, unknown>
  ): Promise<void> {
    const params = JSON.stringify(data);

    await db.query(
      "UPDATE Video SET job_type = $1, job_params = $2 WHERE id = $3",
      [type, params, video.id]
    );

    try {
      await videoProcessingQueue.add(type, data, { jobId: `video-${video.id}` });
      await db.query(
        "UPDATE Video SET status = $1 WHERE id = $2",
        [JobStatus.UPLOADED, video.id]
      );
    } catch (error) {
      await db.query(
        "UPDATE Video SET status = $1 WHERE id = $2",
        [JobStatus.QUEUE_FAILED, video.id]
      );
      throw error;
    }
  }


  async getAllVideo(): Promise<Video[] | null> {
    const result = await db.query<Video>("SELECT * FROM Video")
    if (!result) {
      throw new Error("Failed to fetch result")
    }
    return result;
  }


  async getVideoByIdAndDownloadVideo(videoId: string): Promise<any> {
    const videoRecord = await db.queryOne<Video>("SELECT * FROM Video WHERE id = $1", [videoId]);

    if (!videoRecord) {
      throw new Error("Video not found");
    }

    if (videoRecord.status === JobStatus.UPLOADED) {
      const queueLength = await videoProcessingQueue.getWaitingCount();
      return {
        status: videoRecord.status,
        message: "Video is uploaded and queued for processing",
        queueLength: queueLength
      };
    }

    if (videoRecord.status === JobStatus.PROCESSING) {
      const job = await videoProcessingQueue.getJob(`video-${videoId}`);
      const progress = job ? job.progress : 0;
      return {
        status: videoRecord.status,
        message: "Video is being processed. Please wait some time.",
        progress: progress
      };
    }

    if (videoRecord.status === JobStatus.FAILED || videoRecord.status === JobStatus.QUEUE_FAILED) {
      return {
        status: videoRecord.status,
        message: "Video processing failed. Please try once again"
      };
    }

    //  Handle Completed State (Generate URL)
    if (videoRecord.status === JobStatus.COMPLETED && videoRecord.processed_bucket && videoRecord.processed_object_key) {
      const downloadUrl = await getPresignedDownloadUrl(
        videoRecord.processed_bucket,
        videoRecord.processed_object_key
      );

      // Schedule auto-deletion after 15 minutes (15 * 60 * 1000 ms)
      await videoProcessingQueue.add(VideoEditType.DELETE_VIDEO, {
        videoId: videoRecord.id,
        bucket: videoRecord.original_bucket,
        key: videoRecord.original_object_key,
        processedBucket: videoRecord.processed_bucket,
        processedKey: videoRecord.processed_object_key
      }, {
        jobId: `delete-${videoRecord.id}`, // Deterministic ID to prevent duplicates
        delay: 15 * 60 * 1000 // 15 minutes delay
      });

      return {
        ...videoRecord,
        downloadUrl: downloadUrl
      };
    }

    throw new Error("Video is in an unknown state");
  }
}
