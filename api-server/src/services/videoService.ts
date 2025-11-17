import db from "../db/database.js"
import { deleteVideoFromAws, getPresignedDownloadUrl, uploadVideoToAws } from "../config/aws.config.js"
import { VideoBucket } from "../types/bucketName.js";
import { JobStatus, Video } from "../types/videoType.js";


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
      INSERT INTO video(title, client_job_id, original_bucket, original_object_key)
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


  async getAllVideo(): Promise<Video[] | null> {
    const result = await db.query<Video>("SELECT * FROM video")
    if (!result) {
      throw new Error("Failed to fetch result")
    }
    return result;
  }


  async getVideoByIdAndDownloadVideo(videoId: string): Promise<any> {
    const videoRecord = await db.queryOne<Video>("SELECT * FROM video WHERE id = $1", [videoId]);

    if (!videoRecord) {
      throw new Error("Video not found");
    }

    if (videoRecord.status === JobStatus.UPLOADED) {
      return {
        status: videoRecord.status,
        message: "Video is uploaded and queued for processing"
      };
    }

    if (videoRecord.status === JobStatus.PROCESSING) {
      return {
        status: videoRecord.status,
        message: "Video is being processed. Please wait some time."
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

      return {
        ...videoRecord,
        downloadUrl: downloadUrl
      };
    }

    throw new Error("Video is in an unknown state");
  }
}
