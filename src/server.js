import "dotenv/config";
import { createApp } from "./app.js";
import { connectToMongoDB, getEventsCollection } from "./db.js";
import { createVerifyToken } from "./middleware/verifyToken.js";

const PORT = Number(process.env.PORT) || 5000;
const client = await connectToMongoDB();
const eventsCollection = getEventsCollection(client);

await eventsCollection.createIndex({ date: 1 });
await eventsCollection.createIndex({ creatorId: 1 });
await eventsCollection.createIndex({ "participants.userId": 1 });

const verifyToken = process.env.CLIENT_URL
  ? createVerifyToken({ clientUrl: process.env.CLIENT_URL })
  : (req, res) =>
      res.status(503).json({
        message:
          "Server authentication is not configured. Set CLIENT_URL in server/.env.",
      });

const app = createApp({
  eventsCollection,
  verifyToken,
  clientUrl: process.env.CLIENT_URL,
});

app.listen(PORT, () => {
  console.log(`PlanSocial API is running at http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});
