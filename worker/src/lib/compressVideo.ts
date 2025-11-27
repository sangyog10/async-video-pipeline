import { spawn } from "node:child_process";

/**
 * Compress a video using FFmpeg.
 * @param originalVideoPath - Path to the input video file.
 * @param targetVideoPath - Path where the compressed video will be saved.
 * @param compressionRate - Compression rate (CRF value).
 * @returns Promise<void> that resolves when compression completes successfully.
 */
export const compressVideo = (
  originalVideoPath: string,
  targetVideoPath: string,
  compressionRate: number,
  preset: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", originalVideoPath,
      "-vcodec", "libx264", // Use H.264 codec for video compression
      "-preset", preset, // Preset for encoding speed 
      "-threads", "4", // Use 4 threads for processing
      "-crf", compressionRate.toString(), // Set the CRF value for compression
      "-c:a", "copy", //copy the audio as it is
      "-y", targetVideoPath,
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