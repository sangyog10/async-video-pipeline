import { Job } from "bullmq";
import db from "./db/database.js";
import { downloadVideoFromAws, uploadFileFromLocal } from "./config/aws.config.js";
import { handleAudioExtraction } from "./controller/extractAudio.js";
import { handleVideoResize } from "./controller/resizeVideo.js";
import { VideoEditType } from './types/video.type.js'
import { JobStatus } from "./types/video.type.js";

const downloadedFileStoringFolder = './downloads'


export const processVideoJob = async (job: Job) => {
  const { videoId, bucket, key } = job.data;

  try {
    //update status of the video to processing
    await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.PROCESSING, videoId]);

    //download video for processing
    const downloadedVideoPath = await downloadVideoFromAws(bucket, key, downloadedFileStoringFolder);

    const processedBucketName = bucket;
    const processedKey = `edited-${key}`

    switch (job.name as VideoEditType) {
      // Handling job for extracting audio
      case VideoEditType.EXTRACT_AUDIO:
        const audioPath = await handleAudioExtraction(downloadedVideoPath);
        console.log(" Extracted audio:", audioPath);
        await uploadFileFromLocal(processedBucketName, processedKey, audioPath)
        await db.query("UPDATE Video SET status = $1, processed_bucket = $2, processed_object_key = $3 WHERE id = $4", [JobStatus.COMPLETED, processedBucketName, processedKey, videoId]);
        console.log("Successfully uploaded the edited file to s3")
        break;

      // Handling job for resizing video
      case VideoEditType.RESIZE_VIDEO:
        const { height, width } = job.data;
        const resizedPath = await handleVideoResize(downloadedVideoPath, height, width);
        console.log("Resized video :", resizedPath);
        await uploadFileFromLocal(processedBucketName, processedKey, resizedPath)
        await db.query("UPDATE Video SET status = $1, processed_bucket = $2, processed_object_key = $3 WHERE id = $4", [JobStatus.COMPLETED, processedBucketName, processedKey, videoId]);
        console.log("Successfully uploaded the edited file to s3")
        break;

      default:
        console.log("Unspecified job name")
    }
  } catch (error) {
    console.error("Error. Set the video status to FAILED", error);
    try {
      const res = await db.query(
        "UPDATE Video SET status = $1 WHERE id = $2",
        [JobStatus.FAILED, videoId]
      );
      console.log("DB update result:", res);
    } catch (dbErr) {
      console.error("Failed to update status to FAILED:", dbErr);
    }

    throw error;
  } finally {
    //cleanup the local disk
    //delete downloadedVideoPath
  }

};


