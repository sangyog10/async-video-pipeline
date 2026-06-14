# Asynchronous Video Processing Pipeline

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-00780B?style=for-the-badge&logo=ffmpeg&logoColor=white)

This project is a scalable, asynchronous video processing service built with a decoupled microservice architecture. It is designed to handle time-consuming, CPU-intensive tasks (like audio extraction and video resizing) without blocking the main API, ensuring a responsive user experience and a resilient backend.

## ✨ Key Features

*   **⚡ High-Performance Processing**: The worker service utilizes **multi-threading** to maximize CPU usage for faster video compression and transcoding.
*   **🌐 Web-Optimized Output**: Processed videos are automatically optimized for web playback (`moov` atom at the beginning), ensuring instant streaming start.
*   **🖼️ HD Thumbnails**: Generates high-quality **720p thumbnails** for all uploaded videos.
*   **🗑️ Smart Auto-Cleanup**: To ensure privacy and optimize storage, videos are **automatically deleted** from S3 15 minutes after the download link is generated.
*   **🔄 Self-Healing Architecture**: A dedicated scheduler monitors for stalled jobs and recovers them, ensuring no request is lost.

## 🏗️ Architectural Overview

This system uses a decoupled microservice pattern where services communicate via a persistent job queue. This design ensures that the API (which handles user requests) is completely separate from the `worker` (which performs heavy processing).

```mermaid
flowchart TD
    %% Nodes
    Client["💻 Client / Frontend"]
    APIServer["🌐 API Server (Express)"]
    Worker["⚙️ Worker (FFmpeg)"]
    Postgres[("🐘 PostgreSQL (DB)")]
    MinIO[("📦 MinIO (Object Storage)")]
    Redis[("🔴 Redis (BullMQ Queue)")]

    %% Styling
    classDef default fill:#1e1e2e,stroke:#313244,stroke-width:1px,color:#cdd6f4;
    classDef client fill:#89b4fa,stroke:#1e1e2e,stroke-width:2px,color:#11111b;
    classDef api fill:#a6e3a1,stroke:#1e1e2e,stroke-width:2px,color:#11111b;
    classDef worker fill:#fab387,stroke:#1e1e2e,stroke-width:2px,color:#11111b;
    classDef db fill:#cba6f7,stroke:#1e1e2e,stroke-width:2px,color:#11111b;
    classDef store fill:#89dceb,stroke:#1e1e2e,stroke-width:2px,color:#11111b;
    classDef queue fill:#f38ba8,stroke:#1e1e2e,stroke-width:2px,color:#11111b;

    class Client client;
    class APIServer api;
    class Worker worker;
    class Postgres db;
    class MinIO store;
    class Redis queue;

    %% Relationships / Flow
    Client -->|1. Upload video & process params| APIServer
    APIServer -->|2. Create job metadata| Postgres
    APIServer -->|3. Upload raw video| MinIO
    APIServer -->|4. Push job to queue| Redis
    APIServer -->|5. Return 202 Accepted| Client

    Redis -->|6. Consume job| Worker
    Worker -->|7. Update status to PROCESSING| Postgres
    Worker -->|8. Download raw video| MinIO
    Worker -->|9. Process video using FFmpeg| Worker
    Worker -->|10. Upload processed video/thumbnail| MinIO
    Worker -->|11. Update status to COMPLETED/FAILED| Postgres

    %% Cron loop inside API server
    APIServer -.->|Retry queue-failed jobs| Postgres
```

**The processing flow is as follows:**
1.  **Client** sends a `multipart/form-data` request (video file, job parameters) to the **API Server**.
2.  The **API Server** validates the request, uploads the raw video to **MinIO**, and creates a job record in **PostgreSQL** with a `PENDING_QUEUE` status.
3.  The **API Server** then attempts to add the `jobId` to the **Redis (BullMQ)** queue.
    * **On Success:** The job status in PostgreSQL is updated to `QUEUED`. The client receives a `202Accepted` response.
    * **On Failure:** The status remains `PENDING_QUEUE`. The client receives an error, and the system is left in a safe state.
4.  **Worker** service, which is constantly listening to the queue, picks up the job.
5.  **Worker** updates the job status to `PROCESSING`, downloads the file from MinIO, and executes the required **FFmpeg** command.
6.  Upon completion, the **Worker** uploads the *new* processed file to MinIO and updates the job status in PostgreSQL to `COMPLETED` or `FAILED`.
7.  A background **Scheduler** (running as a cron task inside the API Server) runs periodically, looking for jobs stuck in the `PENDING_QUEUE` state (due to a transient queue failure) and re-attempts to add them to the queue, making the system self-healing.

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

1.  **`frontend`**: The user interface for interacting with the application.
2.  **`api-server`**: The public-facing HTTP service that accepts uploads, creates jobs, and hosts a built-in self-healing scheduler (cron).
3.  **`worker`**: A background service that consumes jobs from the queue and runs FFmpeg.
4.  **`db`**: The PostgreSQL database.
5.  **`minio`**: The S3-compatible object store.
6.  **`redis`**: The message broker for the queue.

## 🚀 Deployment

### Local Development
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Sangyog10/Video-Editor.git
    cd Video-Editor
    ```
2.  **Start Services**
    ```bash
    docker-compose up --build
    ```
3.  **Run Migrations**
    ```bash
    docker exec -it api-server npm run migrate
    ```

### Production (VPS)
For a complete guide on setting up this application on a VPS (Ubuntu/DigitalOcean/Azure) with Nginx, SSL, and Domain configuration, please refer to the **[VPS Setup Guide](./VPS_SETUP.md)**.

## 📝 License
This project is licensed under the ISC License.