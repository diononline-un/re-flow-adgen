import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import { registerRoutes } from "./routes.ts";

const app = Fastify({
  logger: { level: process.env.NODE_ENV === "production" ? "info" : "warn" },
  bodyLimit: 32 * 1024 * 1024,
  trustProxy: true,
});

await app.register(helmet, {
  // JSON-API: kein Browser-Content, CSP etc. übernimmt nginx fürs Frontend
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "same-origin" },
});

// Per-Route-Limits (config.rateLimit je Route); ohne config kein Limit
await app.register(rateLimit, {
  global: false,
  max: 60,
  timeWindow: "1 minute",
});

await registerRoutes(app);

const port = Number(process.env.API_PORT ?? 8787);
await app.listen({ host: "0.0.0.0", port });
