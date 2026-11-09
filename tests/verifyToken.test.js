import express from "express";
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVerifyToken } from "../src/middleware/verifyToken.js";

let server;
let baseUrl;
let privateKey;

function signToken(overrides = {}) {
  return new SignJWT({
    email: "user@example.com",
    name: "Test User",
    image: "https://example.com/avatar.png",
    ...overrides.payload,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject(overrides.subject ?? "user_123")
    .setIssuer(overrides.issuer ?? baseUrl)
    .setAudience(overrides.audience ?? baseUrl)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "5m")
    .sign(privateKey);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  const publicJwk = await exportJWK(keyPair.publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  server = createServer((req, res) => {
    if (req.url === "/api/auth/jwks") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function buildApp() {
  const app = express();
  app.get("/protected", createVerifyToken({ clientUrl: baseUrl }), (req, res) => {
    res.json({ user: req.user });
  });
  return app;
}

describe("createVerifyToken", () => {
  it("accepts a valid token and exposes a narrow user", async () => {
    const token = await signToken();
    const response = await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.user).toEqual({
      id: "user_123",
      email: "user@example.com",
      name: "Test User",
      image: "https://example.com/avatar.png",
    });
  });

  it("rejects a missing token", async () => {
    await request(buildApp()).get("/protected").expect(401);
  });

  it("rejects an expired token", async () => {
    const token = await new SignJWT({ email: "user@example.com", name: "Test User" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject("user_123")
      .setIssuer(baseUrl)
      .setAudience(baseUrl)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);

    await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("rejects a token with the wrong issuer or audience", async () => {
    const wrongIssuer = await signToken({ issuer: "https://attacker.example" });
    await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${wrongIssuer}`)
      .expect(401);

    const wrongAudience = await signToken({ audience: "https://attacker.example" });
    await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${wrongAudience}`)
      .expect(401);
  });

  it("rejects a token signed by another key", async () => {
    const otherKeyPair = await generateKeyPair("RS256");
    const token = await new SignJWT({ email: "user@example.com", name: "Test User" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setSubject("user_123")
      .setIssuer(baseUrl)
      .setAudience(baseUrl)
      .setExpirationTime("5m")
      .sign(otherKeyPair.privateKey);

    await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });
});
