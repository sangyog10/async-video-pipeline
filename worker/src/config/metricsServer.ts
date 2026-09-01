import http from "node:http";
import { register } from "./metrics.config.js";
import db from "../db/database.js";
import { redisConnection } from "./redis.config.js";
import { logger } from "./logger.config.js";

/**
 * Lightweight HTTP server exposing /metrics and /health for the worker,
 * which otherwise has no inbound HTTP surface.
 */
export function startMetricsServer(port = 9100): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === "/metrics") {
        res.setHeader("Content-Type", register.contentType);
        res.end(await register.metrics());
        return;
      }

      if (req.url === "/health") {
        const checks: Record<string, string> = {};
        try {
          await redisConnection.ping();
          checks.redis = "ok";
        } catch {
          checks.redis = "down";
        }
        try {
          await db.healthCheck();
          checks.db = "ok";
        } catch {
          checks.db = "down";
        }
        const healthy = Object.values(checks).every((c) => c === "ok");
        res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: healthy ? "ok" : "degraded", checks }));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    } catch (error) {
      logger.error({ err: error }, "Metrics server error");
      res.writeHead(500);
      res.end("Internal error");
    }
  });

  server.listen(port, () => {
    logger.info({ port }, "Metrics server listening");
  });

  return server;
}
