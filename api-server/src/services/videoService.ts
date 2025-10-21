import db from "../db/database.js"
import { uploadVideoToAws } from "../lib/aws.config.js"
import { VideoBucket } from "../types/bucketName.js";


export class VideoService {
  async uploadVideo(file: Express.Multer.File): Promise<string[]> {
    const key = `${Date.now()}-${file.originalname}`;
    const bucketName = VideoBucket;
    const videoLocation = await uploadVideoToAws(bucketName, key, file.buffer, file.mimetype)
    if (!videoLocation) {
      throw new Error("Failed to upload to database")
    }
    const result = await db.query("INSERT INTO video(title, description, url) VALUES($1, $2, $3) RETURNING *",["Video title", "Video description",videoLocation])
    if(!result){
      throw new Error("Failed to save details to database")
    }
    return result;
  }

  async getAllVideo():Promise<string[]> {
    const result = await db.query("SELECT * FROM video")
    if(!result){
      throw new Error("Failed to fetch result")
    }
    return result;
  }

  async getVideoById(videoId:string): Promise<string[]> {
    const video = await db.query("SELECT * FROM video WHERE id = $1",[videoId])
    if(!video){
      throw new Error("Failed to fetch video")
    }
    return video;
  }
}
