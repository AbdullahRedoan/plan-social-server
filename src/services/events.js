import { ObjectId } from "mongodb";
import { nowWallClock } from "../lib/validation.js";

export function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

export function serializeEvent(document) {
  if (!document) {
    return null;
  }

  return {
    id: document._id.toString(),
    title: document.title,
    description: document.description,
    category: document.category,
    image: document.image,
    location: document.location,
    date: document.date,
    creatorId: document.creatorId,
    creatorName: document.creatorName,
    creatorEmail: document.creatorEmail,
    creatorImage: document.creatorImage ?? null,
    participants: (document.participants ?? []).map((participant) => ({
      userId: participant.userId,
      name: participant.name,
      email: participant.email,
      image: participant.image ?? null,
      joinedAt:
        participant.joinedAt instanceof Date
          ? participant.joinedAt.toISOString()
          : participant.joinedAt,
    })),
    createdAt:
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : document.createdAt,
  };
}

export async function listUpcomingEvents(collection, { limit } = {}) {
  let cursor = collection
    .find({ date: { $gte: nowWallClock() } })
    .sort({ date: 1, createdAt: 1 });

  if (limit) {
    cursor = cursor.limit(limit);
  }

  const documents = await cursor.toArray();
  return documents.map(serializeEvent);
}

export async function listEventsByCreator(collection, creatorId) {
  const documents = await collection
    .find({ creatorId })
    .sort({ date: 1, createdAt: 1 })
    .toArray();

  return documents.map(serializeEvent);
}

export async function listJoinedEvents(collection, userId) {
  const documents = await collection
    .find({ "participants.userId": userId })
    .sort({ date: 1, createdAt: 1 })
    .toArray();

  return documents.map(serializeEvent);
}

export async function getEventById(collection, id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  return serializeEvent(await collection.findOne({ _id: objectId }));
}

export async function createEvent(collection, values, user) {
  const document = {
    ...values,
    creatorId: user.id,
    creatorName: user.name,
    creatorEmail: user.email,
    creatorImage: user.image ?? null,
    participants: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await collection.insertOne(document);
  return serializeEvent({ ...document, _id: result.insertedId });
}

export async function updateEvent(collection, id, values, user) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return { status: "not_found" };
  }

  const existing = await collection.findOne({ _id: objectId });

  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.creatorId !== user.id) {
    return { status: "forbidden" };
  }

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: { ...values, updatedAt: new Date() } },
    { returnDocument: "after" },
  );

  return { status: "updated", event: serializeEvent(result) };
}

export async function deleteEvent(collection, id, user) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return { status: "not_found" };
  }

  const existing = await collection.findOne({ _id: objectId });

  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.creatorId !== user.id) {
    return { status: "forbidden" };
  }

  await collection.deleteOne({ _id: objectId });
  return { status: "deleted" };
}

export async function joinEvent(collection, id, user) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return { status: "not_found" };
  }

  const existing = await collection.findOne({ _id: objectId });

  if (!existing) {
    return { status: "not_found" };
  }

  if (existing.creatorId === user.id) {
    return { status: "owner" };
  }

  const alreadyJoined = (existing.participants ?? []).some(
    (participant) => participant.userId === user.id,
  );

  if (alreadyJoined) {
    return { status: "already_joined" };
  }

  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    {
      $push: {
        participants: {
          userId: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          joinedAt: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  );

  return { status: "joined", event: serializeEvent(result) };
}
