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

function sanitizeUserForSearch(user) {
  if (!user) return null;
  const { password_hash, oauth_id, phone, ...publicData } = user;
  return publicData;
}

export function createAuthRoutes(db, auth, authQueries) {
  return {
    sendOtp: async (req, res) => {
      const { purpose = "signup", channel, destination } = await parseBody(req);

      if (!channel || !destination) {
        sendJson(res, 400, { error: "channel and destination are required" });
        return;
      }

      try {
        const expiresAt = Date.now() + 10 * 60 * 1000;
        const verification = authQueries.createOtpVerification({ purpose, channel, destination, expiresAt });

        console.log(`[auth] OTP sent via ${channel} to ${destination}: ${verification.code}`);

        sendJson(res, 200, {
          ok: true,
          verificationId: verification.id,
          code: verification.code,
          message: `Verification code sent to your ${channel}.`,
          verificationLink: `http://localhost:3000/api/auth/verify?channel=${channel}&destination=${encodeURIComponent(destination)}&code=${verification.code}`,
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Unable to send verification code" });
      }
    },

    resendOtp: async (req, res) => {
      const { purpose = "signup", channel, destination } = await parseBody(req);

      if (!channel || !destination) {
        sendJson(res, 400, { error: "channel and destination are required" });
        return;
      }

      try {
        const expiresAt = Date.now() + 10 * 60 * 1000;
        const verification = authQueries.createOtpVerification({ purpose, channel, destination, expiresAt });

        console.log(`[auth] OTP resent via ${channel} to ${destination}: ${verification.code}`);

        sendJson(res, 200, {
          ok: true,
          verificationId: verification.id,
          code: verification.code,
          message: `A new verification code was sent to your ${channel}.`,
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Unable to resend verification code" });
      }
    },

    forgotPassword: async (req, res) => {
      const { credential } = await parseBody(req);

      if (!credential) {
        sendJson(res, 400, { error: "credential is required" });
        return;
      }

      try {
        const user = authQueries.findUserByCredential(credential);
        if (!user) {
          sendJson(res, 404, { error: "No account found for that email, username, or phone" });
          return;
        }

        const destination = user.email || user.phone;
        const channel = user.email ? "email" : user.phone ? "phone" : null;

        if (!destination || !channel) {
          sendJson(res, 400, { error: "No recovery channel is available for this account" });
          return;
        }

        const expiresAt = Date.now() + 10 * 60 * 1000;
        const verification = authQueries.createOtpVerification({ purpose: "password_reset", channel, destination, expiresAt });

        console.log(`[auth] password reset OTP sent via ${channel} to ${destination}: ${verification.code}`);

        sendJson(res, 200, {
          ok: true,
          verificationId: verification.id,
          channel,
          destination,
          message: `A verification code was sent to your ${channel}.`,
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Unable to start password reset" });
      }
    },

    resetPassword: async (req, res) => {
      const { verificationId, code, newPassword } = await parseBody(req);

      if (!verificationId || !code || !newPassword) {
        sendJson(res, 400, { error: "verificationId, code, and newPassword are required" });
        return;
      }

      if (String(newPassword).length < 8) {
        sendJson(res, 400, { error: "Password must be at least 8 characters" });
        return;
      }

      try {
        const verification = authQueries.verifyOtpCode(verificationId, code);
        if (!verification || verification.purpose !== "password_reset") {
          sendJson(res, 401, { error: "Invalid or expired verification code" });
          return;
        }

        const user = verification.channel === "email"
          ? authQueries.findUserByEmail(verification.destination)
          : authQueries.findUserByPhone(verification.destination);

        if (!user) {
          sendJson(res, 404, { error: "Account no longer exists" });
          return;
        }

        authQueries.updatePasswordForUser(user.id, newPassword);

        sendJson(res, 200, {
          ok: true,
          message: "Password updated successfully.",
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Unable to reset password" });
      }
    },

    verifyOtp: async (req, res) => {
      const { verificationId, code } = await parseBody(req);

      if (!verificationId || !code) {
        sendJson(res, 400, { error: "verificationId and code are required" });
        return;
      }

      try {
        const verification = authQueries.verifyOtpCode(verificationId, code);
        if (!verification) {
          sendJson(res, 401, { error: "Invalid or expired verification code" });
          return;
        }

        sendJson(res, 200, {
          ok: true,
          verified: true,
          message: "Verification code confirmed.",
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Verification failed" });
      }
    },

    register: async (req, res) => {
      const { email, password, fullName, username, phone, verificationId, otpCode } = await parseBody(req);

      if (!password || !fullName || (!email && !phone)) {
        sendJson(res, 400, { error: "email or phone, password, and fullName are required" });
        return;
      }

      if (!verificationId || !otpCode) {
        sendJson(res, 400, { error: "A verified OTP is required before creating an account" });
        return;
      }

      try {
        const verifiedOtp = authQueries.verifyOtpCode(verificationId, otpCode);
        if (!verifiedOtp) {
          sendJson(res, 401, { error: "Invalid or expired verification code" });
          return;
        }

        if (email) {
          const existingUser = authQueries.findUserByEmail(email);
          if (existingUser) {
            sendJson(res, 409, { error: "Email already registered" });
            return;
          }
        }

        if (phone) {
          const existingPhoneUser = authQueries.findUserByPhone(phone);
          if (existingPhoneUser) {
            sendJson(res, 409, { error: "Phone number already registered" });
            return;
          }
        }

        if (username) {
          const existingUsernameUser = authQueries.findUserByUsername(username);
          if (existingUsernameUser) {
            sendJson(res, 409, { error: "Username already taken" });
            return;
          }
        }

        const user = email
          ? authQueries.createUserWithEmailPassword(email, password, fullName, { username, phone })
          : authQueries.createUserWithPhonePassword(phone, password, fullName, { username, email: null });
        const token = auth.signToken(user.id);

        sendJson(res, 201, {
          token,
          user: authQueries.getUserPublicData(user),
        });
      } catch (error) {
        sendJson(res, 500, { error: error.message || "Registration failed" });
      }
    },

    login: async (req, res) => {
      const { credential, email, password } = await parseBody(req);
      const loginCredential = credential || email;

      if (!loginCredential || !password) {
        sendJson(res, 400, { error: "credential and password are required" });
        return;
      }

      try {
        const user = authQueries.findUserByCredential(loginCredential);

        if (!user || !authQueries.verifyPassword(user, password)) {
          sendJson(res, 401, { error: "Invalid credentials" });
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

    searchUsers: async (req, res) => {
      const token = auth.extractToken(req);
      if (!token) {
        sendJson(res, 401, { error: "Missing authorization token" });
        return;
      }

      const payload = auth.verifyToken(token);
      if (!payload) {
        sendJson(res, 401, { error: "Invalid or expired token" });
        return;
      }

      const url = new URL(req.url, "http://localhost");
      const query = url.searchParams.get("q") || "";

      if (!query.trim()) {
        sendJson(res, 400, { error: "Search query is required" });
        return;
      }

      const users = authQueries.searchUsersByUsernameOrPhone(query);
      sendJson(res, 200, {
        users: users.map(sanitizeUserForSearch),
      });
    },

    searchContacts: async (req, res) => {
      const token = auth.extractToken(req);
      if (!token) {
        sendJson(res, 401, { error: "Missing authorization token" });
        return;
      }

      const payload = auth.verifyToken(token);
      if (!payload) {
        sendJson(res, 401, { error: "Invalid or expired token" });
        return;
      }

      const body = await parseBody(req);
      const phoneNumbers = Array.isArray(body.phoneNumbers) ? body.phoneNumbers : [];
      if (!phoneNumbers.length) {
        sendJson(res, 400, { error: "At least one phone number is required" });
        return;
      }

      const users = authQueries.findUsersByPhones(phoneNumbers);
      sendJson(res, 200, {
        users: users.map(sanitizeUserForSearch),
      });
    },
  };
}
