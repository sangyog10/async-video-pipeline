import { Job } from "bullmq";
import db from "./db/database.js";
import { downloadVideoFromAws } from "./config/aws.config.js";
import { handleAudioExtraction } from "./controller/extractAudio.js";
import { handleVideoResize } from "./controller/resizeVideo.js";
import { VideoEditType } from './types/video.type.js'
import { JobStatus } from "./types/video.type.js";


export const processVideoJob = async (job: Job) => {
  const { videoId, bucket, key } = job.data;


  await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.PROCESSING, videoId]);

  const downloadedVideoPath = await downloadVideoFromAws(bucket, key, "./video");

  if (downloadedVideoPath) {
    try {
      switch (job.name as VideoEditType) {
        
        case VideoEditType.EXTRACT_AUDIO:
          const audioPath = await handleAudioExtraction(downloadedVideoPath);
          console.log("✅ Extracted audio:", audioPath);
          break;

        case VideoEditType.RESIZE_VIDEO:
          const { height, width } = job.data;
          const resizedPath = await handleVideoResize(downloadedVideoPath, height, width);
          console.log("Resized video :", resizedPath);
          break;

        default:
          console.log("Unspecified job name")
      }
    } catch (error) {
      await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.FAILED, videoId]);
    }
  }

  await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.COMPLETED, videoId]);
};


