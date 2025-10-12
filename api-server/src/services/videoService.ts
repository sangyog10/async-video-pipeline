import db from "../db/database.js"
import { createBucket, uploadVideoToAws } from "../lib/aws.config.js"

const EditingVideoBucketName = "video-storage"

/**
 * All the database related logic here
 */
export class VideoService {
  async uploadVideo(file: Express.Multer.File) {
    const key = `${Date.now()}-${file.originalname}`;
    const bucketName = EditingVideoBucketName;
    await createBucket(bucketName)
    const videoUrl = await uploadVideoToAws(bucketName, key, file.buffer, file.mimetype)
    if (videoUrl) {
      //save to db
      return { url: videoUrl }
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
