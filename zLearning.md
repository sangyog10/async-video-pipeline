## Setup node ts
- first used ts-node but it created confusion btn .ts and .js, ran locally but does not run in docker
- switched to tsx, which allows us to work in .js extension and build it in dist so both docker and local could find it
but for docker , we need to add extra volume  `- /usr/src/app/dist` at the end 


## Database(postgres)
- decided to use postgres for storing user's and video's data. 
- not using any ORM or ODM, just raw and everything written by myself
- created a pool of postgres with 20 connection
- once the connection is setup btn server and db, it will be persistant and for each query, one connection is picked up from the pool of queue and do the work and relase the connection to pool, so it is very fast


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