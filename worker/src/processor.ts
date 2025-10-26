import { Job } from "bullmq";
import db from "./db/database.js";
import { downloadVideoFromAws } from "./config/aws.config.js";
import { handleAudioExtraction } from "./controller/extractAudio.js";
import { handleVideoResize } from "./controller/resizeVideo.js";
import { VideoEditType } from './types/video.type.js'
import { JobStatus } from "./types/video.type.js";


export const processVideoJob = async (job: Job) => {
  const { videoId, bucket, key } = job.data;

  try {
    //update status of the video to processing
    await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.PROCESSING, videoId]);

    //download video for processing
    const downloadedVideoPath = await downloadVideoFromAws(bucket, key, "./video");

    //run the process as needed acc to the job name
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
    //Todo: Update result to mino

    //update status of the job to completed
    await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.COMPLETED, videoId]);

  } catch (error) {
    console.error(error)
    await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.FAILED, videoId]);
    throw error
  }finally{
    //cleanup the local disk
  }

};


