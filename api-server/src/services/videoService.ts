import db from "../db/database.js"


export class VideoService {
  /**
   * All the databse related logic here
   */

  async uploadVideo() {
    //process all the db realted logic
    return console.log("Uploading Video")
  }

  async getAllVideo() {
    //process all the db realted logic
    console.log("All Video")
    const video = ["video"]
    return video
  }
  async getVideoById() {
    //process all the db realted logic
    return console.log("A Video")
  }
}
