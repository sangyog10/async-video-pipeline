import { QueryResult } from "pg";
import db from "../db/database.js"
import { deleteVideoFromAws, uploadVideoToAws } from "../lib/aws.config.js"
import { VideoBucket } from "../types/bucketName.js";
import { Video } from "../types/videoType.js";


export class VideoService {
  async uploadVideo(file: Express.Multer.File, clientId: string): Promise<Video> {
    const key = `${Date.now()}-${file.originalname}`;
    const title = file.originalname;
    const bucketName = VideoBucket;

    try {
      const metadata = await uploadVideoToAws(bucketName, key, file.buffer, file.mimetype)
      if (!metadata.ETag) {
        throw new Error("Failed to upload to Minio/s3")
      }
      const sql = `
      INSERT INTO video(title, client_job_id, original_bucket, original_object_key)
      VALUES($1, $2, $3, $4)
      RETURNING *
    `;

      const params = [title, clientId, bucketName, key];
      const result = await db.queryOne<Video>(sql, params)
      if (!result) {
        await deleteVideoFromAws(bucketName, key)
        throw new Error("Failed to save details to database, sucessfully deleted the video");
      }
      return result
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
