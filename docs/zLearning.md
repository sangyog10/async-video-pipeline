## Setup node ts
- first used ts-node but it created confusion btn .ts and .js, ran locally but does not run in docker
- switched to tsx, which allows us to work in .js extension and build it in dist so both docker and local could find it
but for docker , we need to add extra volume  `- /usr/src/app/dist` at the end 


## Database(postgres)
- decided to use postgres for storing user's and video's data. 
- not using any ORM or ODM, just raw and everything written by myself
- created a pool of postgres with 20 connection
- once the connection is setup btn server and db, it will be persistant and for each query, one connection is picked up from the pool of queue and do the work and relase the connection to pool, so it is very fast
- First wrote db/database.ts file which contains code to connect to postgres, run query , migratoins etc and imported the startup in main file and run it so that it runs and connection is established everytime i run the server
- File structure

db/
├── database.ts (contains logic to connect, run query, etc)
├── migrations/
│   └── (migration SQL files will go here)
└── migrate.ts (migration runner - you'll build this)


## Object storage(minio)
- It's S3-compatible object storage for large files like videos, scalable, and integrates seamlessly via AWS SDK
- Wrote docke compose for it
- I have exposed port 9001 for using its brower console
- for configuration, the accessKey and secretKey are its user and password resp
- Right now , i try to save the image to the disk using multer and then stream to minio , but this is inefficient approach
- But if we directly stream, the video will be held in RAM and will squeeze ram and might crash too
- So for now, i am buffering in the RAM and limiting to 500mb
- One approach for large files is streaming directly from frontend to storage(complex)

## Docker compose:
1. Understanding volumes
    volumes:
    # ./api-server:/usr/src/app   
    - It will live sync the entire content of my ./api-server(nodejs folder) into contaiener(/usr/src/app) which is also the workdir i set in dockerfile to copy my content and my node js live in it, (:) is for the bind mount
    - Changes on host is immediately seen in container which is great for development, without this, we will rebuild the image every code change—slow!

    # /usr/src/app/node_modules
    - This is anonynomous volume, no host path is specified(nothing on left side of :) so in such case docker creates a temporary unnamed volume managed by docker itself
    - If we run npm instal, node modules will get stored in this volume

    # /usr/src/app/dist
    - Anonynomus volm
    - The file for dist is stored here

     # Flow:
        Run docker-compose up.
        Container starts; mounts host code to /usr/src/app.
        App runs npm install → populates the anonymous node_modules volume.
        App builds → populates the anonymous dist volume.
        Edit code on host → container sees changes instantly.
        Stop with docker-compose down → volumes persist (unless -v).
        Restart → everything's ready, no re-install/rebuild.