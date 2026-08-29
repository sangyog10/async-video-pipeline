import { spawn } from "node:child_process";

export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

export interface WatermarkOptions {
  position: WatermarkPosition;
  opacity: number; // 0-1
  width?: number; // optional target width, height auto-preserved
}

const POSITION_FILTERS: Record<WatermarkPosition, string> = {
  "top-left": "10:10",
  "top-right": "W-w-10:10",
  "bottom-left": "10:H-h-10",
  "bottom-right": "W-w-10:H-h-10",
  "center": "(W-w)/2:(H-h)/2",
};

/**
 * Overlay a watermark image onto a video using FFmpeg.
 *
 * @param originalVideoPath - Path to the source video file.
 * @param watermarkPath - Path to the watermark image (PNG/JPG).
 * @param targetVideoPath - Path where the watermarked video will be saved.
 * @param options - position, opacity (0-1), optional target width.
 * @param onProgress - Optional callback receiving progress 0-100.
 * @returns Promise<void> that resolves when watermarking completes.
 */
export const addWatermark = (
  originalVideoPath: string,
  watermarkPath: string,
  targetVideoPath: string,
  options: WatermarkOptions,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const position = POSITION_FILTERS[options.position] || POSITION_FILTERS["bottom-right"];

    const scaleFilter = options.width && options.width > 0 ? `scale=${options.width}:-1,` : "";
    const opacityFilter =
      options.opacity >= 0 && options.opacity < 1
        ? `format=rgba,colorchannelmixer=aa=${options.opacity.toFixed(2)},`
        : "";
    const needsPreprocess = scaleFilter !== "" || opacityFilter !== "";

    // Add an alpha channel + tune transparency before overlaying, so the
    // watermark blends over the video instead of being pasted opaquely.
    const filter = needsPreprocess
      ? `[1:v]${scaleFilter}${opacityFilter}[wm];[0:v][wm]overlay=${position}:format=auto`
      : `[0:v][1:v]overlay=${position}:format=auto`;

    const ffmpeg = spawn("ffmpeg", [
      "-i", originalVideoPath,
      "-i", watermarkPath,
      "-filter_complex", filter,
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "medium",
      "-c:a", "copy",
      "-movflags", "+faststart",
      "-y", targetVideoPath,
    ]);

    let totalDuration = 0;

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();

      if (onProgress) {
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
