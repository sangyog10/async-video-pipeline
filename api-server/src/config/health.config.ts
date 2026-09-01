import type { Request, Response } from "express";
import { ListBucketsCommand } from "@aws-sdk/client-s3";
import db from "../db/database.js";
import { redisConnection } from "./redis.config.js";
import { s3Client } from "./aws.config.js";

interface HealthStatus {
  status: string;
  uptime: number;
  checks: Record<string, string>;
}

export const healthHandler = async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  try {
    await db.healthCheck();
    checks.db = "ok";
  } catch {
    checks.db = "down";
  }

  try {
    await redisConnection.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "down";
  }

  try {
    await s3Client.send(new ListBucketsCommand());
    checks.minio = "ok";
  } catch {
    checks.minio = "down";
  }

  const healthy = Object.values(checks).every((c) => c === "ok");
  const body: HealthStatus = {
    status: healthy ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    checks,
  };

  res.status(healthy ? 200 : 503).json(body);
};
