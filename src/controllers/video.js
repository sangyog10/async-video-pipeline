const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const fs = require("node:fs/promises");
const util = require("../../lib/util");
const DB = require("../DB");
const FF = require("../../lib/FF");
const jobQueue = require("../../lib/jobQueue");
const cluster = require("node:cluster");


let jobs;
if (cluster.isPrimary) {
   jobs = new jobQueue();
}

const getVideos = (req, res, next) => {
  try {
    DB.update();
    const videos = DB.videos.filter((video) => {
      return video.userId === req.userId;
    });
    res.status(200).json(videos);
  } catch (error) {
    next(error);
  }
};

const uploadVideo = async (req, res, next) => {
  const specifiedFileName = req.headers.filename;
  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");
  const FORMATS_SUPPORTED = ["mov", "mp4"];

  if (FORMATS_SUPPORTED.indexOf(extension) == -1) {
    return next({
      status: 400,
      message: "Unsupported video format",
    });
  }

  //fs module looks for the path relative to the current working directory which spawn this node process
  try {
    await fs.mkdir(`./storage/${videoId}`, { recursive: true });
    const fullPath = `./storage/${videoId}/original.${extension}`; //path of original video file
    const file = await fs.open(fullPath, "w");
    const fileStream = file.createWriteStream();
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;

    await pipeline(req, fileStream);

    //make the thumbnail for video file using ffmpeg
    await FF.makeThumbnail(fullPath, thumbnailPath);

    //get the dimensions
    const dimensions = await FF.getDimension(fullPath);

    DB.update();
    DB.videos.unshift({
      id: DB.videos.length,
      videoId,
      name,
      extension,
      dimensions,
      userId: req.userId,
      extractedAudio: false,
      resizes: {},
    });
    DB.save();

    res
      .status(201)
      .json({ status: "success", msg: "File was uplaoded successfully" });
  } catch (error) {
    util.deleteFolder(`./storage/${videoId}`);
    if (error.code !== "ECONNRESET") return next(error);
  }
};

const getVideoAsset = async (req, res, next) => {
  const videoId = req.query.videoId;
  const type = req.query.type; //thumbnail,original,audio,resize

  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);
  if (!video) {
    return next({ status: 404, message: "Video not found" });
  }

  let file;
  let mimeType;
  let fileName; //final filename for download(with extension)

  try {
    switch (type) {
      case "thumbnail":
        file = await fs.open(`./storage/${videoId}/thumbnail.jpg`, "r");
        mimeType = "image/jpeg";
        break;

      case "original":
        file = await fs.open(
          `./storage/${videoId}/original.${video.extension}`,
          "r"
        );
        mimeType = "video/mp4";
        fileName = `${video.name}.${video.extension}`;
        break;
      case "audio":
        file = await fs.open(`./storage/${videoId}/audio.aac`, "r");
        mimeType = "audio/aac";
        fileName = `${video.name}-audio.aac`;
        break;
      case "resize":
        const dimensions = req.query.dimensions;
        file = await fs.open(
          `./storage/${videoId}/${dimensions}.${video.extension}`,
          "r"
        );
        mimeType = "video/mp4";
        fileName = `${video.name}-${dimensions}.${video.extension}`;
        break;
    }

    const stat = await file.stat();
    const fileStream = file.createReadStream();

    //for download
    if (type !== "thumbnail") {
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);
    res.status(200);
    await pipeline(fileStream, res);
    file.close();
  } catch (error) {
    next(error);
  }
};

const extractAudio = async (req, res, next) => {
  const videoId = req.query.videoId;
  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);

  if (video.extractedAudio) {
    return next({
      status: 400,
      message: "The audio has already been extracted for this video",
    });
  }
  try {
    const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
    const targetAudioPath = `./storage/${videoId}/audio.aac`;
    await FF.extractAudio(originalVideoPath, targetAudioPath);
    video.extractedAudio = true;
    DB.save();
    res.status(200).json({
      status: "success",
      message: "The audio is extracted successfully",
    });
  } catch (error) {
    util.deleteFile(targetAudioPath);
    return next(error);
  }
};

const resizeVideo = async (req, res, next) => {
  const videoId = req.body.videoId;
  const width = Number(req.body.width);
  const height = Number(req.body.height);
  DB.update();
  const video = DB.videos.find((video) => video.videoId === videoId);

  video.resizes[`${width}x${height}`] = { processing: true };
  DB.save();

  if(cluster.isPrimary){//if it is run in single core machine, i.e parent mode is activated
  jobs.enqueue({ type: "resize", videoId, width, height });
  }else{//if run in cpu with more cores, it will behave like child process 

    // message we sent from here will be recived by parent cluster mode in cluster.js by listening to message event
    process.send({
      messageType: "new-resize",
      data: { videoId, width, height },
    });
  }

  res
    .status(200)
    .json({ status: "success", message: "Video is now being processed" });
};

const controller = {
  getVideos,
  uploadVideo,
  getVideoAsset,
  extractAudio,
  resizeVideo,
};

module.exports = controller;
