import db from "../db/database.js"
import { uploadVideoToAws } from "../lib/aws.config.js"
import { VideoBucket } from "../types/bucketName.js";


/**
 * All the database related logic here
 */
export class VideoService {
  async uploadVideo(file: Express.Multer.File) {
    const key = `${Date.now()}-${file.originalname}`;
    const bucketName = VideoBucket;
    const videoLocation = await uploadVideoToAws(bucketName, key, file.buffer, file.mimetype)
    if (videoLocation) {
      //save to db
    return { videoId: videoLocation };
    }
    throw new Error("Upload failed")
  }

  async getAllVideo() {
    //process all the db realted logic
    console.log("All Video")
    const video = ["video"]
    return video
  }
  async getVideoById() {
    //process all the db realted logic
    return "video"
  }
}
