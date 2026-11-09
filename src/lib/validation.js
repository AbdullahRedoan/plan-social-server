export const EVENT_CATEGORIES = [
  "Donation",
  "Plantation",
  "Cleanup",
  "Food Drive",
];

const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const FIELD_LIMITS = {
  title: { min: 2, max: 120 },
  description: { min: 10, max: 2000 },
  location: { min: 2, max: 200 },
};

export function nowWallClock(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isValidWallClock(value) {
  if (typeof value !== "string" || !DATE_TIME_PATTERN.test(value)) {
    return false;
  }

  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours > 23 ||
    minutes > 59
  ) {
    return false;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function validateText(errors, values, body, field) {
  const value = body[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required.`;
    return;
  }

  const trimmed = value.trim();
  const limit = FIELD_LIMITS[field];

  if (trimmed.length < limit.min) {
    errors[field] = `${field[0].toUpperCase()}${field.slice(1)} must be at least ${limit.min} characters.`;
    return;
  }

  if (trimmed.length > limit.max) {
    errors[field] = `${field[0].toUpperCase()}${field.slice(1)} must be ${limit.max} characters or fewer.`;
    return;
  }

  values[field] = trimmed;
}

/**
 * Validates a create or update payload. When `partial` is true only the fields
 * present in the body are validated, which is what PATCH needs.
 */
export function validateEventPayload(body, { partial = false } = {}) {
  const errors = {};
  const values = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      errors: { body: "Request body must be a JSON object." },
      values,
    };
  }

  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);
  const shouldCheck = (field) => !partial || has(field);

  for (const field of ["title", "description", "location"]) {
    if (shouldCheck(field)) {
      validateText(errors, values, body, field);
    }
  }

  if (shouldCheck("category")) {
    const category = body.category;

    if (typeof category !== "string" || !EVENT_CATEGORIES.includes(category)) {
      errors.category = `Category must be one of: ${EVENT_CATEGORIES.join(", ")}.`;
    } else {
      values.category = category;
    }
  }

  if (shouldCheck("image")) {
    const image = body.image;
    let valid = false;

    if (typeof image === "string" && image.trim().length > 0) {
      try {
        const url = new URL(image.trim());
        valid = url.protocol === "http:" || url.protocol === "https:";
      } catch {
        valid = false;
      }
    }

    if (!valid) {
      errors.image = "Image must be a valid http or https URL.";
    } else {
      values.image = image.trim();
    }
  }

  if (shouldCheck("date")) {
    const date = body.date;

    if (!isValidWallClock(date)) {
      errors.date = "Date must use the YYYY-MM-DDTHH:mm format.";
    } else if (date <= nowWallClock()) {
      errors.date = "Event date must be in the future.";
    } else {
      values.date = date;
    }
  }

  return { errors, values };
}
