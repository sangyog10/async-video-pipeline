import { Job } from "bullmq";
import fs from 'fs'
import db from "./db/database.js";
import path from "path";
import { downloadVideoFromAws, uploadFileFromLocal, deleteVideoFromAws, getPresignedDownloadUrl } from "./config/aws.config.js";
import { handleAudioExtraction, handleThumbnailCreation, handleVideoCompression, handleVideoResize, handleVideoTrim, handleGifCreation, handleAddWatermark } from "./controller/index.js";
import { videoProcessingQueue } from "./config/queue.config.js";
import { webhookDeliveryQueue } from "./config/webhookQueue.config.js";
import { VideoEditType } from './types/video.type.js'
import { JobStatus } from "./types/video.type.js";
import { logger } from "./config/logger.config.js";

const downloadedFileStoringFolder = './downloads'


export const processVideoJob = async (job: Job) => {
  const { videoId, bucket, key } = job.data;

  const log = logger.child({
    jobId: job.id,
    videoId,
    jobType: job.name,
    ...(job.data?.correlationId ? { correlationId: job.data.correlationId } : {}),
  });

  let downloadedVideoPath: string | null = null;
  let watermarkDownloadedPath: string | null = null;
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
          log.info({ progress }, `Job progress`);
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
          log.info({ progress }, `Job progress`);
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
          log.info({ progress }, `Job progress`);
          await job.updateProgress(progress);
        });
        break;

      case VideoEditType.ADD_WATERMARK:
        const { watermarkBucket, watermarkKey, position, opacity, watermarkWidth } = job.data;
        if (!watermarkBucket || !watermarkKey) {
          throw new Error("watermarkBucket and watermarkKey are required for ADD_WATERMARK");
        }
        watermarkDownloadedPath = await downloadVideoFromAws(watermarkBucket, watermarkKey, downloadedFileStoringFolder);
        processedFilePath = await handleAddWatermark(downloadedVideoPath, watermarkDownloadedPath, {
          position,
          opacity: opacity ?? 1,
          width: watermarkWidth,
        }, async (progress) => {
          log.info({ progress }, `Job progress`);
          await job.updateProgress(progress);
        });
        break;

      case VideoEditType.DELETE_VIDEO:
        const { processedBucket, processedKey, watermarkBucket: wmBucket, watermarkKey: wmKey } = job.data;

        // Delete original file
        if (bucket && key) {
          await deleteVideoFromAws(bucket, key);
        }

        // Delete processed file
        if (processedBucket && processedKey) {
          await deleteVideoFromAws(processedBucket, processedKey);
        }

        // Delete watermark image if one was used
        if (wmBucket && wmKey) {
          await deleteVideoFromAws(wmBucket, wmKey);
        }

        // Update status to DELETED
        await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.DELETED, videoId]);
        log.info('Successfully deleted video from S3 and updated status.');
        return; // Exit early as there is no "processed file" to upload back

      default:
        log.warn({ jobName: job.name }, "Unspecified job name");
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
    log.info('Successfully uploaded the edited file to S3');

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
        ...(job.data.watermarkBucket && job.data.watermarkKey
          ? { watermarkBucket: job.data.watermarkBucket, watermarkKey: job.data.watermarkKey }
          : {}),
      }, {
        jobId: `delete-${videoId}`,
        delay: 15 * 60 * 1000, // 15 minutes
      });
      log.info('Scheduled auto-deletion in 15 minutes');
    } catch (error) {
      log.error({ err: error }, 'Failed to schedule auto-deletion');
    }

    // Notify the caller via webhook when one is configured
    if (job.data.webhookUrl) {
      try {
        const downloadUrl = await getPresignedDownloadUrl(processedBucketName, processedKey);
        await webhookDeliveryQueue.add("webhook-delivery", {
          eventId: `wh-${videoId}-${Date.now()}`,
          event: "video.completed",
          videoId,
          url: job.data.webhookUrl,
          secret: job.data.webhookSecret,
          status: "COMPLETED",
          downloadUrl,
        });
        log.info('Scheduled completion webhook');
      } catch (error) {
        log.error({ err: error }, 'Failed to schedule completion webhook');
      }
    }


  } catch (error) {
    log.error({ err: error }, 'Error processing video job');
    try {
      await db.query("UPDATE Video SET status = $1 WHERE id = $2", [JobStatus.FAILED, videoId]);
    } catch (dbErr) {
      log.error({ err: dbErr }, 'Failed to update video status to FAILED');
    }
    throw error; // Re-throw for BullMQ to handle retry/failed
  } finally {
    // Clean up all temporary files safely
    const cleanupPromises = [];

    if (downloadedVideoPath) {
      cleanupPromises.push(
        fs.promises.rm(downloadedVideoPath).catch(err => {
          if (err.code !== 'ENOENT') log.error({ err }, 'Failed to delete downloaded file');
        })
      );
    }

    if (watermarkDownloadedPath) {
      cleanupPromises.push(
        fs.promises.rm(watermarkDownloadedPath).catch(err => {
          if (err.code !== 'ENOENT') log.error({ err }, 'Failed to delete watermark file');
        })
      );
    }

    if (processedFilePath) {
      cleanupPromises.push(
        fs.promises.rm(processedFilePath).catch(err => {
          if (err.code !== 'ENOENT') log.error({ err }, 'Failed to delete processed file');
        })
      );
    }

    try {
      await Promise.all(cleanupPromises);
    } catch (err) {
      log.error({ err }, 'Error during file cleanup');
    }
  }
};
