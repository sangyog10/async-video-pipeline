const DB = require("../JSCODE/DB");
const FF = require("./FF");
const util = require("./util");

class jobQueue {
  constructor() {
    this.jobs = [];
    this.currentJob = null;

    //for restarting the ffmpeg if the server is stopped, it will restart the resizing process
    DB.update();
    DB.videos.forEach((video) => {
      Object.keys(video.resizes).forEach((key) => {
        if (video.resizes[key].processing) {
          const [width, height] = key.split("x");
          this.enqueue({
            type: "resize",
            videoId: video.videoId,
            width,
            height,
          });
        }
      });
    });
  }


  enqueue(job) {
    this.jobs.push(job);
    this.executeNext();
  }

  dequeue() {
    return this.jobs.shift(); //returns the first element
  }

  executeNext() {
    if (this.currentJob) return;
    this.currentJob = this.dequeue();
    if (!this.currentJob) return;
    this.execute(this.currentJob);
  }

  async execute(job) {
    if (job.type === "resize") {
      const { width, height, videoId } = job;
      DB.update();
      const video = DB.videos.find((video) => video.videoId === videoId);

      const originalVideoPath = `./storage/${videoId}/original.${video.extension}`;
      const targetVideoPath = `./storage/${videoId}/${width}x${height}.${video.extension}`; //path of resize video

      try {
        await FF.resize(originalVideoPath, targetVideoPath, width, height);
        DB.update();
        const video = DB.videos.find((video) => video.videoId === videoId);
        video.resizes[`${width}x${height}`].processing = false;
        DB.save();
        console.log("No. of jobs remaining:", this.jobs.length);
      } catch (error) {
        console.log(error);
        util.deleteFile(targetVideoPath);
      }
    }
    this.currentJob = null;
    this.executeNext();
  }
}

module.exports = jobQueue;
