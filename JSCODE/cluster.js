const cluster=require('node:cluster')
const jobQueue = require("../lib/jobQueue");
const { log } = require('node:console');


if(cluster.isPrimary){
    const jobs=new jobQueue();

    const coresCount=require("node:os").availableParallelism();

    for(let i=0; i<coresCount; i++){
        cluster.fork();
    }
    
    cluster.on("message",(worker,message)=>{
        if(message.messageType==="new-resize"){
            const {videoId, height,width}=message.data;
            jobs.enqueue({
                type:"resize",
                videoId,
                width,
                height
            })
        }
    })

    cluster.on("exit",(worker,code,signal)=>{
        console.log(`Restarting the dead worker`);
        cluster.fork();
    })



}else{
    require("./index")
}




/*
normally it will run resize operation of videos equals to the number of cores. I have 12 cores, so each core 
will have its own queue and all cores will be busy if i upload 12 video at a time and further video will be in
queue for each core.i.e  new ffmpeg process will start for each videos.

Now to run all operations as in the single process(i.e only one process is running but use all cores) and keeping all the
 video in queue , we can use cluster messagee and communicate with child and parent. child will sent message to the parent 
 */