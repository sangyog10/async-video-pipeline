import path from "path";
import fs from "fs";
import { createGif, GifOptions } from "../lib/index.js";

export const handleGifCreation = async (
  videoPath: string,
  options: GifOptions,
  onProgress?: (progress: number) => void
) => {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = "./uploads";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetGifPath = path.join(outputDir, `${videoName}.gif`);
  await createGif(videoPath, targetGifPath, options, onProgress);
  return targetGifPath;
};
