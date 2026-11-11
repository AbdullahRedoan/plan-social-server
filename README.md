# PlanSocial API

The Express 5 + MongoDB backend for **PlanSocial**, a community event platform.
It stores events and their participants, and verifies the JWTs that the Next.js
client (Better Auth) issues before allowing any write, join, or private listing.

## Stack

- Node.js (ESM) with Express 5
- MongoDB Node driver 7
- `jose` for remote JWKS verification
- Vitest + Supertest + `mongodb-memory-server` for tests

## Endpoints

| Method | Path                 | Auth      | Purpose                                     |
| ------ | -------------------- | --------- | ------------------------------------------- |
| GET    | `/`                  | Public    | Liveness message                            |
| GET    | `/health`            | Public    | API + database health                       |
| GET    | `/events`            | Public    | Upcoming events, sorted by date (`?limit=`) |
| GET    | `/events/:id`        | Public    | Single event                                |
| GET    | `/events/mine`       | Bearer    | Events created by the signed-in user        |
| GET    | `/events/joined`     | Bearer    | Events the signed-in user joined            |
| POST   | `/events`            | Bearer    | Create an event                             |
| PATCH  | `/events/:id`        | Owner     | Update an event                             |
| DELETE | `/events/:id`        | Owner     | Delete an event                             |
| POST   | `/events/:id/join`   | Bearer    | Join an event                               |

Full request/response shapes live in [`docs/api-contract.md`](docs/api-contract.md).

## Authentication

The Next.js client runs Better Auth and exposes a JWKS at
`${CLIENT_URL}/api/auth/jwks`. This server verifies the `Authorization: Bearer`
token against that JWKS, checking the issuer and audience against `CLIENT_URL`.
The verified payload supplies `sub`, `email`, `name`, and `image`; the API never
trusts identity fields sent in a request body.

## Environment

Copy `.env.example` to `.env` and fill in:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
DB_NAME=plan-social
CLIENT_URL=http://localhost:3000
PORT=5000
```

`CLIENT_URL` must be the exact origin of the running client with no trailing
slash, because the JWKS URL is derived from it. In production it becomes the
Vercel domain.

## Scripts

```bash
npm install
npm run dev     # node --watch src/server.js
npm start       # node src/server.js
npm test        # vitest run
npm run test:watch
```

`node index.js` still works as a shim for the original entrypoint.

## Deploying

The API ships two entrypoints for the same Express app:

- `src/server.js` — long-running server (`npm start`) for Render, Railway, or a
  local machine.
- `api/index.js` — Vercel serverless handler that reuses the app and keeps one
  MongoDB client alive per warm lambda instance. `vercel.json` rewrites every
  path (`/`, `/health`, `/events/*`) to it.

**On Vercel:**

1. Create a MongoDB Atlas cluster and a database user, then copy the connection
   string into `MONGODB_URI`.
2. Import this repo as a Vercel project with no framework preset. Vercel picks
   up `vercel.json` automatically — no build command is needed.
3. Set `MONGODB_URI`, `DB_NAME`, and `CLIENT_URL` (the client's exact origin,
   no trailing slash) in the project's environment variables.
4. Verify `https://<project>.vercel.app/health` returns
   `{"status":"ok","database":"connected"}`.
5. Point the client's `NEXT_PUBLIC_API_URL` at that URL.

**On Render or another Node host:** build `npm install`, start `npm start`,
health check path `/health`, and the same three variables plus `PORT`.

Remember to update the OAuth callback URLs in Google and GitHub to the deployed
client domain.

## Data model

Events embed their creator (`creatorId`, `creatorName`, `creatorEmail`,
`creatorImage`) and a `participants` array of `{ userId, name, email, image,
joinedAt }`. Event dates are stored as wall-clock strings in
`YYYY-MM-DDTHH:mm` format so the organizer's chosen time renders exactly as
entered, regardless of server timezone.

## Tests

```bash
npm test
```

Tests run against an in-memory MongoDB and a local JWKS server, so they never
touch the real database or the network.
