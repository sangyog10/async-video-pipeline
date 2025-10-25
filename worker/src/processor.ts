import { Job } from "bullmq";
import db from "./db/database.js";
import { downloadVideoFromAws } from "./config/aws.config.js";
import { handleAudioExtraction } from "./controller/extractAudio.js";
import { handleVideoResize } from "./controller/resizeVideo.js";


export const processVideoJob = async (job: Job) => {
  const { videoId, bucketName, key, work } = job.data;

  await db.query("UPDATE Video SET status = $1 WHERE id = $2", ["PROCESSING", videoId]);

  const downloadedVideoPath = await downloadVideoFromAws(bucketName, key, "./video");

  // if (work?.type === "extractAudio") {
  // const audioPath = await handleAudioExtraction(downloadedVideoPath);
  //   console.log("✅ Extracted audio:", audioPath);
  // }

  // if (work?.type === "resizeVideo") {
  //   const { width, height } = work;
  const width = 256;
  const height = 256;
  const resizedPath = await handleVideoResize(downloadedVideoPath, width, height);
  //   console.log("✅ Resized video:", resizedPath);
  // }

  await db.query("UPDATE Video SET status = $1 WHERE id = $2", ["COMPLETED", videoId]);
};


