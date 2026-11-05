# plan-social server

Express 5 API backed by MongoDB, written in plain JavaScript (ESM).

## Stack

- Node.js with `"type": "module"` — use `import`, not `require`.
- Express 5, `mongodb` driver 7, `dotenv`.
- Single entrypoint: `index.js`.
- Listens on port 5000.

## Current state

- MongoDB connects at module load; if the connection fails the process crashes
  before serving any request.
- `POST /add-event` inserts `req.body` into the `events` collection.
- Known gaps: no `express.json()` middleware (so `req.body` is currently
  `undefined`), no CORS, no validation, no error handling, no tests, hardcoded
  port. Fix these as features require them, not all at once.

## Commands

- `npm install`
- `node index.js`
- No `dev` or `test` script exists yet. Do not invent one.

## Environment

- `MONGODB_URI` lives in `.env`, which is gitignored. Never read, print, or
  commit it.
- `.env.example` documents the required variables with placeholders.

## Conventions

- Use ESM imports and match the existing indentation in `index.js`.
- When the file grows, split it into `src/app.js` (Express app, no `listen`)
  and `src/server.js` (connect to MongoDB, then listen) so routes can be tested
  with Supertest without opening a port.
- Put routes under `src/routes/` and keep database access out of route handlers.
- Validate request bodies and return proper status codes: 201 on create,
  400 on validation failure, 404 for missing resources.
- Planned test stack: Vitest + Supertest + `mongodb-memory-server`.

## Before committing

- Start the server and exercise the endpoint you changed.
- Check `git status --short` and confirm `.env` is not staged.
