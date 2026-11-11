import "dotenv/config";

import { createApp } from "../src/app.js";
import { connectToMongoDB, getEventsCollection } from "../src/db.js";
import { createVerifyToken } from "../src/middleware/verifyToken.js";

/**
 * Vercel serverless entrypoint.
 *
 * Vercel runs Node functions instead of a long-lived `app.listen` server, so
 * this wraps the same Express app in a request handler and keeps one MongoDB
 * client alive per warm lambda instance. `src/server.js` remains the
 * entrypoint for local and traditional Node hosting.
 */
let cachedApp;

async function getApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const client = await connectToMongoDB();
  const eventsCollection = getEventsCollection(client);

  const verifyToken = process.env.CLIENT_URL
    ? createVerifyToken({ clientUrl: process.env.CLIENT_URL })
    : (req, res) =>
        res.status(503).json({
          message:
            "Server authentication is not configured. Set CLIENT_URL in the environment.",
        });

  cachedApp = createApp({
    eventsCollection,
    verifyToken,
    clientUrl: process.env.CLIENT_URL,
  });

  return cachedApp;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    console.error("Failed to initialize the API.", error);
    return res.status(503).json({
      message:
        "The API is not connected to its database yet. Try again shortly.",
    });
  }
}
