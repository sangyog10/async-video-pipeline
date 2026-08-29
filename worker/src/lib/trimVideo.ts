import { spawn } from "node:child_process";

/**
 * Trim a video to a time range using FFmpeg.
 *
 * Uses input seeking (`-ss` before `-i`) for fast start, then re-encodes
 * the requested duration so the cut is frame-accurate.
 *
 * @param originalVideoPath - Path to the source video file.
 * @param targetVideoPath - Path where the trimmed video will be saved.
 * @param startTime - Start time in seconds.
 * @param endTime - End time in seconds.
 * @param onProgress - Optional callback receiving progress 0-100.
 * @returns Promise<void> that resolves when trimming completes successfully.
 */
export const trimVideo = (
  originalVideoPath: string,
  targetVideoPath: string,
  startTime: number,
  endTime: number,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;

    const ffmpeg = spawn("ffmpeg", [
      "-ss", startTime.toString(),
      "-i", originalVideoPath,
      "-t", duration.toString(),
      "-vcodec", "libx264",
      "-preset", "medium",
      "-crf", "18",
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y", targetVideoPath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();

      if (onProgress) {
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (timeMatch) {
          const hours = parseFloat(timeMatch[1]);
          const minutes = parseFloat(timeMatch[2]);
          const seconds = parseFloat(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const progress = Math.min(Math.round((currentTime / duration) * 100), 100);
          onProgress(progress);
        }
      }
    });

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
