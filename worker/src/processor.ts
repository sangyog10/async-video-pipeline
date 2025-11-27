import { Job } from "bullmq";
import fs from 'fs'
import db from "./db/database.js";
import path from "path";
import { downloadVideoFromAws, uploadFileFromLocal } from "./config/aws.config.js";
import { handleAudioExtraction, handleThumbnailCreation, handleVideoCompression, handleVideoResize } from "./controller/index.js";
import { VideoEditType } from './types/video.type.js'
import { JobStatus } from "./types/video.type.js";

const downloadedFileStoringFolder = './downloads'


export const processVideoJob = async (job: Job) => {
  const { videoId, bucket, key } = job.data;

  let downloadedVideoPath: string | null = null;
  let processedFilePath: string = "";

  try {
    // Update status to PROCESSING
    await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.PROCESSING, videoId]);

    // Download video from S3
    downloadedVideoPath = await downloadVideoFromAws(bucket, key, downloadedFileStoringFolder);

    //pause the operation for 5 seconds to simulate processing time
    // await new Promise(resolve => setTimeout(resolve, 10000));

    // Process video based on job type
    switch (job.name as VideoEditType) {
      case VideoEditType.EXTRACT_AUDIO:
        processedFilePath = await handleAudioExtraction(downloadedVideoPath);
        break;

      case VideoEditType.RESIZE_VIDEO:
        const { dimension } = job.data;
        if (!dimension?.width || !dimension?.height) {
          throw new Error("Dimension width and height are required for RESIZE_VIDEO");
        }
        processedFilePath = await handleVideoResize(downloadedVideoPath, dimension.width, dimension.height);
        break;

      case VideoEditType.COMPRESS_VIDEO:
        const { compressionRate, preset } = job.data;
        if (!compressionRate) {
          throw new Error("Compression rate is required for COMPRESS_VIDEO");
        }
        processedFilePath = await handleVideoCompression(downloadedVideoPath, compressionRate, preset || "ultrafast");
        break;

      case VideoEditType.CREATE_THUMBNAIL:
        const { timestamp } = job.data;
        if (timestamp === undefined || timestamp === null) {
          throw new Error("Timestamp is required for creating thumbnail");
        }
        processedFilePath = await handleThumbnailCreation(downloadedVideoPath, timestamp);
        break;

      default:
        console.log("Unspecified job name:", job.name);
        throw new Error(`Unsupported job type: ${job.name}`);
    }

    // Upload processed file back to S3
    const originalNameWithoutExt = path.basename(key, path.extname(key)); //Get the filename without the old extension (e.g. "123-video")
    const newExtension = path.extname(processedFilePath); // Get the extension of the NEW processed file (e.g. ".png" or ".mp4")
    const processedKey = `edited-${originalNameWithoutExt}${newExtension}`;
    const processedBucketName = bucket;
    await uploadFileFromLocal(processedBucketName, processedKey, processedFilePath);

    // Update status to COMPLETED and store processed file info
    await db.query(
      "UPDATE Video SET status = $1, processed_bucket = $2, processed_object_key = $3 WHERE id = $4",
      [JobStatus.COMPLETED, processedBucketName, processedKey, videoId]
    );
    console.log("Successfully uploaded the edited file to S3");


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

    if (processedFilePath) {
      cleanupPromises.push(
        fs.promises.rm(processedFilePath).catch(err => {
          if (err.code !== 'ENOENT') console.error(`Failed to delete ${processedFilePath}:`, err);
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


