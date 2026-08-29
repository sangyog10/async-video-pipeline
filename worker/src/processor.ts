import { Job } from "bullmq";
import fs from 'fs'
import db from "./db/database.js";
import path from "path";
import { downloadVideoFromAws, uploadFileFromLocal, deleteVideoFromAws } from "./config/aws.config.js";
import { handleAudioExtraction, handleThumbnailCreation, handleVideoCompression, handleVideoResize, handleVideoTrim, handleGifCreation } from "./controller/index.js";
import { videoProcessingQueue } from "./config/queue.config.js";
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
        processedFilePath = await handleVideoCompression(downloadedVideoPath, compressionRate, preset || "ultrafast", async (progress) => {
          console.log(`Video ${videoId} progress: ${progress}%`);
          await job.updateProgress(progress);
        });
        break;

      case VideoEditType.CREATE_THUMBNAIL:
        const { timestamp } = job.data;
        if (timestamp === undefined || timestamp === null) {
          throw new Error("Timestamp is required for creating thumbnail");
        }
        processedFilePath = await handleThumbnailCreation(downloadedVideoPath, timestamp);
        break;

      case VideoEditType.TRIM_VIDEO:
        const { startTime, endTime } = job.data;
        if (startTime === undefined || endTime === undefined || startTime < 0 || endTime <= startTime) {
          throw new Error("Valid startTime and endTime are required for TRIM_VIDEO");
        }
        processedFilePath = await handleVideoTrim(downloadedVideoPath, startTime, endTime, async (progress) => {
          console.log(`Video ${videoId} progress: ${progress}%`);
          await job.updateProgress(progress);
        });
        break;

      case VideoEditType.CREATE_GIF:
        const { fps: gifFps, width: gifWidth, startTime: gifStartTime, duration: gifDuration } = job.data;
        if (gifFps === undefined || gifWidth === undefined || gifFps <= 0 || gifWidth <= 0) {
          throw new Error("Valid fps and width are required for CREATE_GIF");
        }
        processedFilePath = await handleGifCreation(downloadedVideoPath, {
          fps: gifFps,
          width: gifWidth,
          startTime: gifStartTime ?? 0,
          duration: gifDuration,
        }, async (progress) => {
          console.log(`Video ${videoId} progress: ${progress}%`);
          await job.updateProgress(progress);
        });
        break;

      case VideoEditType.DELETE_VIDEO:
        const { processedBucket, processedKey } = job.data;

        // Delete original file
        if (bucket && key) {
          await deleteVideoFromAws(bucket, key);
        }

        // Delete processed file
        if (processedBucket && processedKey) {
          await deleteVideoFromAws(processedBucket, processedKey);
        }

        // Update status to DELETED
        await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.DELETED, videoId]);
        console.log(`Successfully deleted video ${videoId} from S3 and updated status.`);
        return; // Exit early as there is no "processed file" to upload back

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

    // Schedule auto-deletion 15 minutes after completion so the user can
    // download the result within the window. Deterministic jobId prevents
    // duplicate cleanup jobs. A scheduling failure must NOT fail the job.
    try {
      await videoProcessingQueue.add(VideoEditType.DELETE_VIDEO, {
        videoId,
        bucket,
        key,
        processedBucket: processedBucketName,
        processedKey,
      }, {
        jobId: `delete-${videoId}`,
        delay: 15 * 60 * 1000, // 15 minutes
      });
      console.log(`Scheduled auto-deletion for video ${videoId} in 15 minutes`);
    } catch (error) {
      console.error(`Failed to schedule auto-deletion for video ${videoId}:`, error);
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


