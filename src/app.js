import cors from "cors";
import express from "express";
import { createEventsRouter } from "./routes/events.js";

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function createApp({ eventsCollection, verifyToken, clientUrl } = {}) {
  if (!eventsCollection) {
    throw new Error("createApp requires an eventsCollection.");
  }

  if (typeof verifyToken !== "function") {
    throw new Error("createApp requires a verifyToken middleware.");
  }

  const app = express();
  const allowedOrigin = clientUrl ? normalizeOrigin(clientUrl) : null;

  app.use(
    cors({
      origin: allowedOrigin ?? true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (req, res) => {
    res.json({ message: "PlanSocial API is running." });
  });

  app.use("/events", createEventsRouter({ eventsCollection, verifyToken }));

  app.use((req, res) => {
    res.status(404).json({ message: "Route not found." });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Request body is not valid JSON." });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  });

  return app;
}
