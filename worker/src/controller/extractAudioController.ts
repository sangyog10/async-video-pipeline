import path from "path";
import fs from "fs";
import { extractAudio } from "../lib/index.js";


export const handleAudioExtraction = async (videoPath: string) => {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  const outputDir = "./uploads";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const targetAudioPath = path.join(outputDir, `${videoName}.aac`);
  await extractAudio(videoPath, targetAudioPath);
  return targetAudioPath;
};

