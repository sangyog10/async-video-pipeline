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
  preset: string,
  onProgress?: (progress: number) => void
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

    let duration = 0;

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();

      // Parse duration
      if (!duration) {
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        if (durationMatch) {
          const hours = parseFloat(durationMatch[1]);
          const minutes = parseFloat(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }

      // Parse current time and calculate progress
      if (duration && onProgress) {
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