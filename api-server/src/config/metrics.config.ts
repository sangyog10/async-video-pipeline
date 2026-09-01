import client from "prom-client";
import type { Request, Response, NextFunction } from "express";

export const register = client.register;

client.collectDefaultMetrics({ register });

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
});

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const jobsEnqueuedTotal = new client.Counter({
  name: "video_jobs_enqueued_total",
  help: "Total number of video processing jobs enqueued",
  labelNames: ["jobType"],
});

export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime();
  res.on("finish", () => {
    const route = (req.route?.path as string) || req.path;
    const status = String(res.statusCode);
    const seconds = process.hrtime(start)[0] + process.hrtime(start)[1] / 1e9;
    httpRequestsTotal.labels(req.method, route, status).inc();
    httpRequestDuration.labels(req.method, route, status).observe(seconds);
  });
  next();
};

export const metricsHandler = async (_req: Request, res: Response) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(String(error));
  }
};
