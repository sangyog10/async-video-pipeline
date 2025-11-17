# Asynchronous Video Processing Pipeline

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-00780B?style=for-the-badge&logo=ffmpeg&logoColor=white)

This project is a scalable, asynchronous video processing service built with a decoupled microservice architecture. It is designed to handle time-consuming, CPU-intensive tasks (like audio extraction and video resizing) without blocking the main API, ensuring a responsive user experience and a resilient backend.

##  Architectural Overview

This system uses a decoupled microservice pattern where services communicate via a persistent job queue. This design ensures that the API (which handles user requests) is completely separate from the `worker` (which performs heavy processing).


**The processing flow is as follows:**
1.  **Client** sends a `multipart/form-data` request (video file, job parameters) to the **API Server**.
2.  The **API Server** validates the request, uploads the raw video to **MinIO**, and creates a job record in **PostgreSQL** with a `PENDING_QUEUE` status.
3.  The **API Server** then attempts to add the `jobId` to the **Redis (BullMQ)** queue.
    * **On Success:** The job status in PostgreSQL is updated to `QUEUED`. The client receives a `202Accepted` response.
    * **On Failure:** The status remains `PENDING_QUEUE`. The client receives an error, and the system is left in a safe state.
4.  The **Worker** service, which is constantly listening to the queue, picks up the job.
5.  The **Worker** updates the job status to `PROCESSING`, downloads the file from MinIO, and executes the required **FFmpeg** command.
6.  Upon completion, the **Worker** uploads the *new* processed file to MinIO and updates the job status in PostgreSQL to `COMPLETED` or `FAILED`.
7.  A separate **Scheduler** service runs periodically, looking for jobs stuck in the `PENDING_QUEUE` state (due to a transient queue failure) and re-attempts to add them to the queue, making the system self-healing.

## ✨ Core Architectural Decisions

This project was built to demonstrate modern backend engineering principles:

* **Decoupling:** The `api-server` (I/O-bound) is fully decoupled from the `worker` (CPU-bound). This means the API can handle thousands of requests per second, even if the worker is under heavy load.
* **Asynchronous Processing:** By using a message queue, the API can respond instantly (`202Accepted`) while the long-running FFmpeg process (which can take minutes) executes in the background.
* **Scalability:** The services are containerized and can be scaled independently. If the job queue gets deep, you can scale the `worker` service to 10 instances without ever touching the `api-server`.
    * `docker compose up -d --scale worker=5`
* **Resilience & Self-Healing:**
    * **Job Retries:** BullMQ is configured to automatically retry failed FFmpeg jobs with an exponential backoff.
    * **"Janitor" Service:** The `scheduler` service acts as a "janitor," solving the "dual write" problem. If the API fails to add a job to the queue *after* saving it to the database, the janitor will find it and re-queue it, ensuring eventual consistency.
* **Stateless Services:** Both the `api-server` and `worker` are stateless. All persistent state is externalized to PostgreSQL (metadata), MinIO (file storage), and Redis (queue state), which is essential for scaling.

## 🛠️ Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Services** | Node.js (TypeScript) | The runtime for both the API and worker. |
| **API Framework** | Express | Handles all incoming HTTP requests, validation, and job creation. |
| **Processing** | FFmpeg | A robust C library for all video/audio manipulation. |
| **Queue** | BullMQ | A fast, persistent job queue library built on Redis. |
| **Broker** | Redis | The backend for BullMQ, storing all pending, active, and failed jobs. |
| **Database** | PostgreSQL | The single source of truth for all job metadata and status. |
| **File Storage** | MinIO | S3-compatible object storage for large video files. |
| **Containerization**| Docker & Docker Compose | For building, running, and networking all services in an isolated, reproducible environment. |

## 📦 Service Breakdown

This project consists of 6 core services defined in `docker-compose.yml`:

1.  **`api-server`**: The public-facing HTTP service.
2.  **`worker`**: A background service that consumes jobs from the queue and runs FFmpeg.
3.  **`scheduler`**: A singleton background service that runs scheduled "janitor" tasks for system self-healing.
4.  **`db`**: The PostgreSQL database.
5.  **`minio`**: The S3-compatible object store.
6.  **`redis`**: The message broker for the queue.

## ⚙️ How to Run (Local Development)

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
* A Git client.

### 1. Clone the Repository
```sh
git clone [https://github.com/Sangyog10/Video-Editor.git]
cd project```

### Run Migration
```sh
docker exec -it api-server npm run migrate 
```