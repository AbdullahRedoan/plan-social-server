import { createRemoteJWKSet, jwtVerify } from "jose";

function originOf(url) {
  return new URL(url).origin;
}

/**
 * Builds Express middleware that verifies a Better Auth JWT with the client's
 * remote JWKS endpoint. The verified payload becomes `req.user`.
 */
export function createVerifyToken({ clientUrl, jwksPath = "/api/auth/jwks" } = {}) {
  if (!clientUrl) {
    throw new Error("CLIENT_URL is required to verify tokens.");
  }

  const issuer = originOf(clientUrl);
  const jwks = createRemoteJWKSet(new URL(jwksPath, issuer));

  return async function verifyToken(req, res, next) {
    const header = req.headers.authorization;

    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Missing or invalid authorization header." });
    }

    const token = header.slice("Bearer ".length).trim();

    if (!token) {
      return res.status(401).json({ message: "Missing bearer token." });
    }

    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: issuer,
      });

      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        return res.status(401).json({ message: "Token is missing a subject." });
      }

      req.user = {
        id: payload.sub,
        email: typeof payload.email === "string" ? payload.email : "",
        name: typeof payload.name === "string" ? payload.name : "",
        image: typeof payload.image === "string" ? payload.image : null,
      };

      return next();
    } catch {
      return res.status(401).json({ message: "Invalid or expired token." });
    }
  };
}
