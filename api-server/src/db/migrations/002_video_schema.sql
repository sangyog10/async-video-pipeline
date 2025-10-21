CREATE TYPE job_status as ENUM(
    'UPLOADED',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

ALTER TABLE Video 
ADD COLUMN client_job_id UUID NOT NULL UNIQUE,
ADD COLUMN status job_status NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN original_bucket VARCHAR NOT NULL,
ADD COLUMN original_object_key VARCHAR(255) NOT NULL,
ADD COLUMN processed_bucket VARCHAR(255),
ADD COLUMN processed_object_key VARCHAR(255);


