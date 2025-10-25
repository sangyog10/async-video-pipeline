import db from "../db/database.js"
import { deleteVideoFromAws, uploadVideoToAws } from "../config/aws.config.js"
import { VideoBucket } from "../types/bucketName.js";
import { Video } from "../types/videoType.js";
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

      //Add video to queue
      try {
        await videoProcessingQueue.add("Video-queue", {
          videoId:videoRecord.id,
          bucketName,
          key,
          work:"Resize", //TODO:Change this acc to user's request
        })

        await db.query(
          'UPDATE Video SET status = $1 WHERE id = $2',
          ['UPLOADED', videoRecord.id]
        );
        console.log("Video added to the queue and updated the status")

      } catch (queueError) {
        console.error("Failed to add to queue:", queueError);
        await db.query(
          'UPDATE Video SET status = $1  WHERE id = $2',
          ['QUEUE_FAILED', videoRecord.id]
        );
        return videoRecord
      }

      return videoRecord
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


  async getVideoById(videoId: string): Promise<Video | null> {
    const video = await db.queryOne<Video>("SELECT * FROM video WHERE id = $1", [videoId])
    if (!video) {
      throw new Error("Failed to fetch video")
    }
    return video;
  }
}
