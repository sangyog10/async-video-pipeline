CREATE TYPE job_status as ENUM(
    'UPLOADED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
)

CREATE TABLE Video(
    id SERIAL PRIMARY KEY,
    client_job_id UUID NOT NULL UNIQUE,
    status job_status NOT NULL
    title VARCHAR(255) NOT NULL,
    description TEXT,
    url VARCHAR(512) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);