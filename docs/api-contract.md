# PlanSocial API contract

Base URL locally: `http://localhost:5000`

All responses are JSON. Errors use:

```json
{
  "message": "Please fix the highlighted fields.",
  "errors": { "title": "Title is required." }
}
```

`errors` is optional and only present for validation failures.

## Authentication

Better Auth runs inside the Next.js client at `http://localhost:3000/api/auth`.
Express verifies the JWT issued by Better Auth's JWT plugin.

- Send `Authorization: Bearer <jwt>` on every protected endpoint.
- Tokens are verified against the JWKS at `${CLIENT_URL}/api/auth/jwks`.
- A valid token must contain `sub` (user id), `email`, `name`, and may contain
  `image`.
- The API never trusts a user id, email, or name sent in the request body. The
  identity always comes from the verified token.
- Missing, malformed, expired, or wrongly signed tokens return `401`.

## Event document

```json
{
  "id": "665f1c2b8f1b2c0012a4b6d1",
  "title": "Riverside park cleanup",
  "description": "A morning of litter picking and trail clearing.",
  "category": "Cleanup",
  "image": "https://images.example.com/cleanup.jpg",
  "location": "Riverside Park, North Gate",
  "date": "2026-12-15T09:00",
  "creatorId": "user_abc123",
  "creatorName": "Ayesha Rahman",
  "creatorEmail": "ayesha@example.com",
  "creatorImage": null,
  "participants": [
    {
      "userId": "user_def456",
      "name": "Tanvir Islam",
      "email": "tanvir@example.com",
      "image": null,
      "joinedAt": "2026-11-09T10:12:00.000Z"
    }
  ],
  "createdAt": "2026-11-09T10:00:00.000Z"
}
```

### Date format

`date` is a wall-clock value in `YYYY-MM-DDTHH:mm` format with no timezone.
This keeps the organizer's chosen date and time exactly as entered regardless of
where the server runs. Public listings only return events whose `date` is greater
than or equal to the server's current wall-clock time, sorted ascending.

### Categories

`Donation`, `Plantation`, `Cleanup`, `Food Drive`.

## Endpoints

### `GET /`

Health check.

```json
{ "message": "PlanSocial API is running." }
```

### `GET /events`

Public. Returns upcoming events sorted by `date` ascending.

Query:

- `limit` — optional positive integer, maximum 100.

```http
GET /events?limit=6
```

### `GET /events/:id`

Public. Returns one event.

- `200` event
- `404` `{ "message": "Event not found." }`

### `GET /events/mine`

Protected. Returns the signed-in user's events, sorted by `date` ascending.

### `GET /events/joined`

Protected. Returns events where `participants.userId` matches the token `sub`,
sorted by `date` ascending.

### `POST /events`

Protected. Creates an event owned by the signed-in user.

Request body:

```json
{
  "title": "Riverside park cleanup",
  "description": "A morning of litter picking and trail clearing.",
  "category": "Cleanup",
  "image": "https://images.example.com/cleanup.jpg",
  "location": "Riverside Park, North Gate",
  "date": "2026-12-15T09:00"
}
```

Validation:

- `title`: required, 2–120 characters.
- `description`: required, 10–2000 characters.
- `category`: required, one of the four categories.
- `image`: required, absolute `http` or `https` URL.
- `location`: required, 2–200 characters.
- `date`: required, `YYYY-MM-DDTHH:mm`, a real calendar date, and in the future.

Responses:

- `201` created event
- `400` validation failure
- `401` missing or invalid token

### `PATCH /events/:id`

Protected and owner-only. Accepts any subset of the create fields. At least one
valid field is required. A supplied `date` must still be in the future.

- `200` updated event
- `400` validation failure
- `401` missing or invalid token
- `403` `{ "message": "You can only edit your own events." }`
- `404` event not found

### `DELETE /events/:id`

Protected and owner-only.

- `204` deleted
- `401` missing or invalid token
- `403` `{ "message": "You can only delete your own events." }`
- `404` event not found

### `POST /events/:id/join`

Protected. Adds the signed-in user to `participants` using the verified token.

- `200` updated event
- `400` `{ "message": "You cannot join an event you organize." }`
- `401` missing or invalid token
- `404` event not found
- `409` `{ "message": "You have already joined this event." }`

## Environment

Server:

```env
MONGODB_URI=
DB_NAME=plan-social
CLIENT_URL=http://localhost:3000
PORT=5000
```

`CLIENT_URL` must have no trailing slash and must point at the running Next.js
app so the JWKS endpoint is reachable.

Client:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
MONGODB_URI=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```
