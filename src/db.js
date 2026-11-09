import { MongoClient } from "mongodb";

const DEFAULT_DB_NAME = "plan-social";

export function getDbName() {
  return process.env.DB_NAME || DEFAULT_DB_NAME;
}

export function getEventsCollection(client, dbName = getDbName()) {
  return client.db(dbName).collection("events");
}

export async function connectToMongoDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  const client = new MongoClient(uri);
  await client.connect();
  console.log(`Connected to MongoDB (${getDbName()}).`);

  return client;
}
