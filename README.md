## Start the service 
`docker compose up --build` #if any changes in package file
`docker compose up`

## Run migration;
`docker exec api-server npm run migrate`

## Go inside the database:
`docker exec -it db sh`
` psql -U myuser -d mydb` -> myuser-> username(env), 

` \dt` to list all tables
` \d tableName` to describe the table
`\q` to quit postgres




## Flow
- User uploads the video, multer buffers it and send it to minio S3 for storage
- For editing, a separate process is used, which will pick the job from message queue and do the job


## Tracking the client
- With video, client also generates unique ID from their browser and send to backend
- server stores the path of video and client Id in database, video in minio and job in message queue
- The frontend will store the id in localstorage
- client will poll the status, to /status route
- server sends back the video once video is completed editing

User's req:
video -> video
jobId -> a1b2c3d4-e5f6-7890-1234-567890abcdef(something randomly selected)



## Todo:
Right now the uplaod is limited to 500mb, change the inmemory storage to direct streaming
