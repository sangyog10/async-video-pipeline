import { spawn } from "node:child_process";


/**
 * Create a thumbnail from a video using FFmpeg.
 *  * @param originalVideoPath - Path to the input video file.
 * * @param targetThumbnailPath - Path where the thumbnail image will be saved.
 * * @param timestamp - Timestamp (in seconds) to capture the thumbnail.
 * * @returns Promise<void> that resolves when thumbnail creation completes successfully.
 */
export const createThumbnail = (
  originalVideoPath: string,
  targetThumbnailPath: string,
  timestamp: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-ss", timestamp.toString(), // timeframe to the specified timestamp
      "-i", originalVideoPath,
      "-vframes", "1", // capture only one frame
      "-vf", "scale=1280:-1", // scale width to 1280px (720p), height automatic
      "-q:v", "2",
      "-y", targetThumbnailPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};