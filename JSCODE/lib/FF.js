//we are using the ffmpeg to do all of our works

const { spawn } = require("node:child_process");

//terminal command we use to make thumbnail is:
// $  ffmpeg -i 1\ -\ How\ to\ Get\ Help.mp4 -ss 5 -vframes 1 thumbnail.jpg
//i.e ffmpeg -i videofile -ss 5 -vframes 1 thumbnail.format

const makeThumbnail = (fullPath, thumbnailPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      fullPath,
      "-ss",
      "5",
      "-vframes",
      "1",
      thumbnailPath,
    ]);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg exited with code:${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

//terminal command to get the dimension is:
//$ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 video.mp4
const getDimension = (fullPath) => {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=s=x:p=0",
      fullPath,
    ]);

    let dimensions = "";
    ffprobe.stdout.on("data", (data) => {
      dimensions += data.toString("utf-8");
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        dimensions = dimensions.replace(/\s/g, "").split("x"); //removing extra spaces at end
        resolve({
          width: Number(dimensions[0]),
          height: Number(dimensions[1]),
        });
      } else {
        reject(`FFprobe exited with code:${code}`);
      }
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });
  });
};

// command : $ffmpeg -i video.mp4 -vn -c:a copy audio.aac
const extractAudio = (originalVideoPath, targetAudioPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath,
      "-vn",
      "-c:a",
      "copy",
      targetAudioPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg exited with code:${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

//here -threads 2 means that ffmpeg will use 2 threads 
const resize = (originalVideoPath, targetVideoPath, width, height) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath,
      "-vf",
      `scale=${width}x${height}`,
      "-c:a",
      "copy",
      "-threads",
      "2",
      "-y",
      targetVideoPath,
    ]);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg exited with code:${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

module.exports = { makeThumbnail, getDimension, extractAudio, resize };
