import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { registerRoutes } from "./routes.ts";

const app = Fastify({
  logger: { level: process.env.NODE_ENV === "production" ? "info" : "warn" },
  bodyLimit: 32 * 1024 * 1024,
});

await app.register(rateLimit, {
  max: 300,
  timeWindow: "1 minute",
});

await registerRoutes(app);

const port = Number(process.env.API_PORT ?? 8787);
await app.listen({ host: "0.0.0.0", port });
