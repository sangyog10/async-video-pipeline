import { Job } from "bullmq";
import fs from 'fs'
import db from "./db/database.js";
import { downloadVideoFromAws, uploadFileFromLocal } from "./config/aws.config.js";
import { handleAudioExtraction } from "./controller/extractAudio.js";
import { handleVideoResize } from "./controller/resizeVideo.js";
import { VideoEditType } from './types/video.type.js'
import { JobStatus } from "./types/video.type.js";

const downloadedFileStoringFolder = './downloads'


export const processVideoJob = async (job: Job) => {
  const { videoId, bucket, key } = job.data;

  let downloadedVideoPath: string | null = null;
  let audioPath: string | null = null;
  let resizedPath: string | null = null;

  try {
    // Update status to PROCESSING
    await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.PROCESSING, videoId]);

    // Download video from S3
    downloadedVideoPath = await downloadVideoFromAws(bucket, key, downloadedFileStoringFolder);

    const processedBucketName = bucket;
    const processedKey = `edited-${key}`;

    switch (job.name as VideoEditType) {
      case VideoEditType.EXTRACT_AUDIO:
        audioPath = await handleAudioExtraction(downloadedVideoPath);
        console.log("Extracted audio:", audioPath);
        await uploadFileFromLocal(processedBucketName, processedKey, audioPath);
        await db.query(
          "UPDATE Video SET status = $1, processed_bucket = $2, processed_object_key = $3 WHERE id = $4",
          [JobStatus.COMPLETED, processedBucketName, processedKey, videoId]
        );
        console.log("Successfully uploaded the edited file to S3");
        break;

      case VideoEditType.RESIZE_VIDEO:
        const { dimension } = job.data;
        if (!dimension?.width || !dimension?.height) {
          throw new Error("Dimension width and height are required for RESIZE_VIDEO");
        }
        resizedPath = await handleVideoResize(downloadedVideoPath, dimension.width, dimension.height);
        await uploadFileFromLocal(processedBucketName, processedKey, resizedPath);
        await db.query(
          "UPDATE Video SET status = $1, processed_bucket = $2, processed_object_key = $3 WHERE id = $4",
          [JobStatus.COMPLETED, processedBucketName, processedKey, videoId]
        );
        console.log("Successfully uploaded the resized video to S3");
        break;

      default:
        console.log("Unspecified job name:", job.name);
        throw new Error(`Unsupported job type: ${job.name}`);
    }
  } catch (error) {
    console.error("Error processing video job:", error);
    try {
      await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.FAILED, videoId]);
    } catch (dbErr) {
      console.error("Failed to update video status to FAILED:", dbErr);
    }
    throw error; // Re-throw for BullMQ to handle retry/failed
  } finally {
    // Clean up all temporary files safely
    const cleanupPromises = [];

    if (downloadedVideoPath) {
      cleanupPromises.push(
        fs.promises.rm(downloadedVideoPath).catch(err => {
          if (err.code !== 'ENOENT') console.error(`Failed to delete ${downloadedVideoPath}:`, err);
        })
      );
    }

    if (audioPath) {
      cleanupPromises.push(
        fs.promises.rm(audioPath).catch(err => {
          if (err.code !== 'ENOENT') console.error(`Failed to delete ${audioPath}:`, err);
        })
      );
    }

    if (resizedPath) {
      cleanupPromises.push(
        fs.promises.rm(resizedPath).catch(err => {
          if (err.code !== 'ENOENT') console.error(`Failed to delete ${resizedPath}:`, err);
        })
      );
    }

    try {
      await Promise.all(cleanupPromises);
      console.log("Temporary files cleaned up successfully.");
    } catch (err) {
      console.error("Error during file cleanup:", err);
    }
  }
};


