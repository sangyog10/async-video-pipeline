import { spawn } from "node:child_process";

export interface GifOptions {
  fps: number;
  width: number;
  startTime: number;
  duration?: number;
}

/**
 * Create a looping GIF from a video using FFmpeg.
 *
 * Uses a two-pass palette filter graph (palettegen + paletteuse) for better
 * color quality than a naive conversion.
 *
 * @param originalVideoPath - Path to the source video file.
 * @param targetGifPath - Path where the GIF will be saved.
 * @param options - fps, output width, optional start time and duration.
 * @param onProgress - Optional callback receiving progress 0-100.
 * @returns Promise<void> that resolves when the GIF is created.
 */
export const createGif = (
  originalVideoPath: string,
  targetGifPath: string,
  options: GifOptions,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { fps, width, startTime, duration } = options;

    const inputSeek = startTime > 0 ? ["-ss", startTime.toString()] : [];
    const durationArgs = duration && duration > 0 ? ["-t", duration.toString()] : [];

    const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

    let totalDuration = duration && duration > 0 ? duration : 0;

    const ffmpeg = spawn("ffmpeg", [
      ...inputSeek,
      "-i", originalVideoPath,
      ...durationArgs,
      "-vf", filter,
      "-loop", "0",
      "-y", targetGifPath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();

      if (onProgress) {
        // If no explicit duration was given, fall back to the source duration
        if (!totalDuration) {
          const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (durationMatch) {
            const hours = parseFloat(durationMatch[1]);
            const minutes = parseFloat(durationMatch[2]);
            const seconds = parseFloat(durationMatch[3]);
            totalDuration = hours * 3600 + minutes * 60 + seconds;
          }
        }

        if (totalDuration) {
          const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
          if (timeMatch) {
            const hours = parseFloat(timeMatch[1]);
            const minutes = parseFloat(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentTime = hours * 3600 + minutes * 60 + seconds;
            const progress = Math.min(Math.round((currentTime / totalDuration) * 100), 100);
            onProgress(progress);
          }
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
