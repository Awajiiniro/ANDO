function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function createGoogleOAuthClient() {
  const { google } = await import("googleapis");
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback"
  );
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createAuthRoutes(db, auth, authQueries) {
  return {
    register: async (req, res) => {
      const { email, password, fullName, authMethod } = await parseBody(req);

      if (!email || !password || !fullName) {
        sendJson(res, 400, { error: "email, password, and fullName are required" });
        return;
      }

      try {
        const existingUser = authQueries.findUserByEmail(email);
        if (existingUser) {
          sendJson(res, 409, { error: "Email already registered" });
          return;
        }

        const user = authQueries.createUserWithEmailPassword(email, password, fullName);
        const token = auth.signToken(user.id);

        sendJson(res, 201, {
          token,
          user: { id: user.id, email: user.email, full_name: user.full_name },
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Registration failed" });
      }
    },

    login: async (req, res) => {
      const { email, password } = await parseBody(req);

      if (!email || !password) {
        sendJson(res, 400, { error: "email and password are required" });
        return;
      }

      try {
        const user = authQueries.findUserByEmail(email);

        if (!user || !authQueries.verifyPassword(user, password)) {
          sendJson(res, 401, { error: "Invalid email or password" });
          return;
        }

        const token = auth.signToken(user.id);
        sendJson(res, 200, {
          token,
          user: authQueries.getUserPublicData(user),
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Login failed" });
      }
    },

    registerPhone: async (req, res) => {
      const { phone, password, fullName } = await parseBody(req);

      if (!phone || !password || !fullName) {
        sendJson(res, 400, { error: "phone, password, and fullName are required" });
        return;
      }

      try {
        const existingUser = authQueries.findUserByPhone(phone);
        if (existingUser) {
          sendJson(res, 409, { error: "Phone number already registered" });
          return;
        }

        const user = authQueries.createUserWithPhonePassword(phone, password, fullName);
        const token = auth.signToken(user.id);

        sendJson(res, 201, {
          token,
          user: { id: user.id, phone: user.phone, full_name: user.full_name },
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Registration failed" });
      }
    },

    loginPhone: async (req, res) => {
      const { phone, password } = await parseBody(req);

      if (!phone || !password) {
        sendJson(res, 400, { error: "phone and password are required" });
        return;
      }

      try {
        const user = authQueries.findUserByPhone(phone);

        if (!user || !authQueries.verifyPassword(user, password)) {
          sendJson(res, 401, { error: "Invalid phone or password" });
          return;
        }

        const token = auth.signToken(user.id);
        sendJson(res, 200, {
          token,
          user: authQueries.getUserPublicData(user),
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Login failed" });
      }
    },

    googleCallback: async (req, res) => {
      const { idToken } = await parseBody(req);

      if (!idToken) {
        sendJson(res, 400, { error: "idToken is required" });
        return;
      }

      try {
        const oauth2Client = await createGoogleOAuthClient();
        const ticket = await oauth2Client.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        if (!email) {
          sendJson(res, 400, { error: "Google account must have an email" });
          return;
        }

        let user = authQueries.createOrUpdateUserWithOAuth("google", {
          oauthId: googleId,
          email,
          fullName: name || email.split("@")[0],
          profilePictureUrl: picture,
        });

        const token = auth.signToken(user.id);
        sendJson(res, 200, {
          token,
          user: authQueries.getUserPublicData(user),
        });
      } catch (error) {
        sendJson(res, 401, { error: error.message || "Google authentication failed" });
      }
    },

    logout: async (req, res) => {
      try {
        const token = auth.extractToken(req);
        if (token) {
          authQueries.revokeToken(token);
        }
        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Logout failed" });
      }
    },

    verify: async (req, res) => {
      const token = auth.extractToken(req);

      if (!token) {
        sendJson(res, 401, { error: "Missing token" });
        return;
      }

      const payload = auth.verifyToken(token);

      if (!payload) {
        sendJson(res, 401, { error: "Invalid or expired token" });
        return;
      }

      const user = authQueries.findUserById(payload.userId);

      if (!user) {
        sendJson(res, 404, { error: "User not found" });
        return;
      }

      sendJson(res, 200, {
        user: authQueries.getUserPublicData(user),
      });
    },
  };
}
