import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const users = {
  "token-owner": {
    id: "user_owner",
    email: "owner@example.com",
    name: "Owner User",
    image: "https://example.com/owner.png",
  },
  "token-other": {
    id: "user_other",
    email: "other@example.com",
    name: "Other User",
    image: null,
  },
};

let mongod;
let client;
let eventsCollection;
let app;

function fakeVerifyToken(req, res, next) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = users[token];

  if (!user) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  req.user = user;
  return next();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function futureDate(daysFromNow = 7) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(10, 0, 0, 0);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function payload(overrides = {}) {
  return {
    title: "Riverside park cleanup",
    description: "A morning of litter picking and trail clearing.",
    category: "Cleanup",
    image: "https://example.com/cleanup.jpg",
    location: "Riverside Park, North Gate",
    date: futureDate(),
    ...overrides,
  };
}

async function seed(events) {
  const documents = events.map((event) => ({
    participants: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorId: users["token-owner"].id,
    creatorName: users["token-owner"].name,
    creatorEmail: users["token-owner"].email,
    creatorImage: users["token-owner"].image,
    ...event,
  }));

  const result = await eventsCollection.insertMany(documents);
  return Object.values(result.insertedIds).map((id) => id.toString());
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  eventsCollection = client.db("plan-social-test").collection("events");
  app = createApp({ eventsCollection, verifyToken: fakeVerifyToken });
});

afterAll(async () => {
  await client?.close();
  await mongod?.stop();
});

afterEach(async () => {
  await eventsCollection.deleteMany({});
});

describe("GET /health", () => {
  it("reports that the API and database are reachable", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toEqual({ status: "ok", database: "connected" });
  });
});

describe("GET /events", () => {
  it("returns only upcoming events sorted by date", async () => {
    await seed([
      payload({ title: "Later event", date: futureDate(20) }),
      payload({ title: "Sooner event", date: futureDate(3) }),
      payload({ title: "Already happened", date: "2020-01-01T09:00" }),
    ]);

    const response = await request(app).get("/events").expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].title).toBe("Sooner event");
    expect(response.body[1].title).toBe("Later event");
  });

  it("honours the limit and rejects invalid limits", async () => {
    await seed([
      { ...payload({ title: "One", date: futureDate(3) }) },
      { ...payload({ title: "Two", date: futureDate(4) }) },
      { ...payload({ title: "Three", date: futureDate(5) }) },
    ]);

    const limited = await request(app).get("/events?limit=2").expect(200);
    expect(limited.body.map((event) => event.title)).toEqual(["One", "Two"]);

    await request(app).get("/events?limit=0").expect(400);
    await request(app).get("/events?limit=abc").expect(400);
  });
});

describe("GET /events/:id", () => {
  it("returns an event and 404s for unknown or malformed ids", async () => {
    const [id] = await seed([payload({ title: "Find me" })]);

    const response = await request(app).get(`/events/${id}`).expect(200);
    expect(response.body.title).toBe("Find me");
    expect(response.body.creatorEmail).toBe(users["token-owner"].email);

    await request(app).get("/events/not-a-real-id").expect(404);
    await request(app)
      .get("/events/665f1c2b8f1b2c0012a4b6d1")
      .expect(404);
  });
});

describe("POST /events", () => {
  it("requires a token", async () => {
    await request(app).post("/events").send(payload()).expect(401);
  });

  it("rejects invalid payloads with field errors", async () => {
    const response = await request(app)
      .post("/events")
      .set("Authorization", "Bearer token-owner")
      .send({ title: "x", category: "Nope", image: "ftp://bad", date: "2020-01-01T10:00" })
      .expect(400);

    expect(response.body.errors).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      image: expect.any(String),
      location: expect.any(String),
      date: expect.any(String),
    });
  });

  it("stamps the creator from the verified token, not the body", async () => {
    const response = await request(app)
      .post("/events")
      .set("Authorization", "Bearer token-owner")
      .send({
        ...payload(),
        creatorId: "forged-id",
        creatorEmail: "forged@example.com",
      })
      .expect(201);

    expect(response.body.creatorId).toBe(users["token-owner"].id);
    expect(response.body.creatorEmail).toBe(users["token-owner"].email);
    expect(response.body.participants).toEqual([]);
  });
});

describe("ownership", () => {
  it("blocks a different user from editing or deleting", async () => {
    const [id] = await seed([payload()]);

    await request(app)
      .patch(`/events/${id}`)
      .set("Authorization", "Bearer token-other")
      .send({ title: "Hijacked" })
      .expect(403);

    await request(app)
      .delete(`/events/${id}`)
      .set("Authorization", "Bearer token-other")
      .expect(403);
  });

  it("lets the owner edit and delete", async () => {
    const [id] = await seed([payload()]);

    const updated = await request(app)
      .patch(`/events/${id}`)
      .set("Authorization", "Bearer token-owner")
      .send({ title: "Updated title", date: futureDate(30) })
      .expect(200);

    expect(updated.body.title).toBe("Updated title");

    await request(app)
      .delete(`/events/${id}`)
      .set("Authorization", "Bearer token-owner")
      .expect(204);

    await request(app).get(`/events/${id}`).expect(404);
  });
});

describe("POST /events/:id/join", () => {
  it("adds the token user to participants once", async () => {
    const [id] = await seed([payload()]);

    const joined = await request(app)
      .post(`/events/${id}/join`)
      .set("Authorization", "Bearer token-other")
      .expect(200);

    expect(joined.body.participants).toHaveLength(1);
    expect(joined.body.participants[0]).toMatchObject({
      userId: users["token-other"].id,
      email: users["token-other"].email,
      name: users["token-other"].name,
    });

    await request(app)
      .post(`/events/${id}/join`)
      .set("Authorization", "Bearer token-other")
      .expect(409);
  });

  it("does not let an organizer join their own event", async () => {
    const [id] = await seed([payload()]);

    await request(app)
      .post(`/events/${id}/join`)
      .set("Authorization", "Bearer token-owner")
      .expect(400);
  });
});

describe("private listings", () => {
  it("returns only the signed-in user's events", async () => {
    await seed([
      { ...payload({ title: "Mine" }) },
      {
        ...payload({ title: "Other's event" }),
        creatorId: users["token-other"].id,
        creatorEmail: users["token-other"].email,
        creatorName: users["token-other"].name,
      },
    ]);

    const response = await request(app)
      .get("/events/mine")
      .set("Authorization", "Bearer token-owner")
      .expect(200);

    expect(response.body.map((event) => event.title)).toEqual(["Mine"]);
  });

  it("returns joined events sorted by event date", async () => {
    await seed([
      {
        ...payload({ title: "Later joined", date: futureDate(10) }),
        participants: [
          {
            userId: users["token-other"].id,
            name: users["token-other"].name,
            email: users["token-other"].email,
            image: null,
            joinedAt: new Date(),
          },
        ],
      },
      {
        ...payload({ title: "Sooner joined", date: futureDate(4) }),
        participants: [
          {
            userId: users["token-other"].id,
            name: users["token-other"].name,
            email: users["token-other"].email,
            image: null,
            joinedAt: new Date(),
          },
        ],
      },
      payload({ title: "Not joined" }),
    ]);

    const response = await request(app)
      .get("/events/joined")
      .set("Authorization", "Bearer token-other")
      .expect(200);

    expect(response.body.map((event) => event.title)).toEqual([
      "Sooner joined",
      "Later joined",
    ]);
  });
});
