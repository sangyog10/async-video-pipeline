import { spawn } from "node:child_process";

/**
 * Extracts audio from a video file using FFmpeg.
 *
 * @param originalVideoPath - Path to the source video file
 * @param targetAudioPath - Path where the extracted audio should be saved
 * @returns Promise<void> - Resolves when extraction is complete
 */
export const extractAudio = (
  originalVideoPath: string,
  targetAudioPath: string
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath, // input video
      "-vn",             // no video
      "-c:a",
      "copy",            // copy audio codec without re-encoding
      targetAudioPath,   // output audio file
    ]);

    // Listen for process exit
    ffmpeg.on("close", (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    // Listen for errors spawning the process
    ffmpeg.on("error", (err: Error) => {
      reject(err);
    });
  });
};



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
  compressionRate: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", originalVideoPath,
      "-vcodec", "libx264", // Use H.264 codec for video compression
      "-preset", "ultrafast", // Preset for encoding speed 
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
      "-vf", "scale=320:-1", // scale width to 320px, height automatic
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