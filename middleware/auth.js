import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export function createAuthMiddleware() {
  return {
    signToken: (userId) => {
      return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    },

    verifyToken: (token) => {
      try {
        return jwt.verify(token, JWT_SECRET);
      } catch {
        return null;
      }
    },

    extractToken: (req) => {
      const authHeader = req.headers.authorization || "";
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        return parts[1];
      }
      return null;
    },

    middleware: (auth) => {
      return (req, res, next) => {
        const token = auth.extractToken(req);

        if (!token) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Missing authorization token" }));
          return;
        }

        const payload = auth.verifyToken(token);

        if (!payload) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid or expired token" }));
          return;
        }

        req.user = { id: payload.userId };
        next();
      };
    },
  };
}
