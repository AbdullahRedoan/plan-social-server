import { Router } from "express";
import { validateEventPayload } from "../lib/validation.js";
import {
  createEvent,
  deleteEvent,
  getEventById,
  joinEvent,
  listEventsByCreator,
  listJoinedEvents,
  listUpcomingEvents,
  updateEvent,
} from "../services/events.js";

function parseLimit(rawLimit) {
  if (rawLimit === undefined) {
    return { limit: null };
  }

  if (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit)) {
    return { error: "Limit must be a positive integer." };
  }

  const limit = Number(rawLimit);

  if (limit < 1 || limit > 100) {
    return { error: "Limit must be between 1 and 100." };
  }

  return { limit };
}

export function createEventsRouter({ eventsCollection, verifyToken }) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { limit, error } = parseLimit(req.query.limit);

    if (error) {
      return res.status(400).json({ message: error });
    }

    const events = await listUpcomingEvents(eventsCollection, { limit });
    return res.json(events);
  });

  // Declared before "/:id" so Express does not treat these as ids.
  router.get("/mine", verifyToken, async (req, res) => {
    const events = await listEventsByCreator(eventsCollection, req.user.id);
    return res.json(events);
  });

  router.get("/joined", verifyToken, async (req, res) => {
    const events = await listJoinedEvents(eventsCollection, req.user.id);
    return res.json(events);
  });

  router.post("/", verifyToken, async (req, res) => {
    const { errors, values } = validateEventPayload(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    const event = await createEvent(eventsCollection, values, req.user);
    return res.status(201).json(event);
  });

  router.post("/:id/join", verifyToken, async (req, res) => {
    const result = await joinEvent(eventsCollection, req.params.id, req.user);

    if (result.status === "not_found") {
      return res.status(404).json({ message: "Event not found." });
    }

    if (result.status === "owner") {
      return res
        .status(400)
        .json({ message: "You cannot join an event you organize." });
    }

    if (result.status === "already_joined") {
      return res
        .status(409)
        .json({ message: "You have already joined this event." });
    }

    return res.json(result.event);
  });

  router.get("/:id", async (req, res) => {
    const event = await getEventById(eventsCollection, req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    return res.json(event);
  });

  router.patch("/:id", verifyToken, async (req, res) => {
    const { errors, values } = validateEventPayload(req.body, {
      partial: true,
    });

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors,
      });
    }

    if (Object.keys(values).length === 0) {
      return res.status(400).json({
        message: "Provide at least one field to update.",
      });
    }

    const result = await updateEvent(
      eventsCollection,
      req.params.id,
      values,
      req.user,
    );

    if (result.status === "not_found") {
      return res.status(404).json({ message: "Event not found." });
    }

    if (result.status === "forbidden") {
      return res
        .status(403)
        .json({ message: "You can only edit your own events." });
    }

    return res.json(result.event);
  });

  router.delete("/:id", verifyToken, async (req, res) => {
    const result = await deleteEvent(
      eventsCollection,
      req.params.id,
      req.user,
    );

    if (result.status === "not_found") {
      return res.status(404).json({ message: "Event not found." });
    }

    if (result.status === "forbidden") {
      return res
        .status(403)
        .json({ message: "You can only delete your own events." });
    }

    return res.status(204).send();
  });

  return router;
}
