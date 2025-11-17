import { spawn } from "node:child_process";

/**
 * Resize a video using FFmpeg.
 * 
 * @param originalVideoPath - Path to the input video file.
 * @param targetVideoPath - Path where the resized video will be saved.
 * @param width - Target video width.
 * @param height - Target video height.
 * @returns Promise<void> that resolves when resizing completes successfully.
 */
export const resizeVideo = (
  originalVideoPath: string,
  targetVideoPath: string,
  width: number,
  height: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", originalVideoPath,
      "-vf", `scale=${width}:${height}`,
      "-c:a", "copy",
      "-threads", "2",
      "-y", targetVideoPath,
    ]);

    // ffmpeg.stderr.on("data", (data) => {
    //   console.log(`[FFmpeg stderr]: ${data}`);
    // });

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
