import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

export function createAuthQueries(db) {
  const saltRounds = 10;

  return {
    findUserByEmail: (email) => {
      return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    },

    findUserByUsername: (username) => {
      return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    },

    findUserByCredential: (credential) => {
      const normalized = String(credential || "").trim();
      if (!normalized) return null;
      return db.prepare("SELECT * FROM users WHERE email = ? OR username = ? OR phone = ?").get(normalized, normalized, normalized);
    },

    findUserByPhone: (phone) => {
      return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
    },

    findUsersByPhones: (phones) => {
      if (!phones?.length) return [];
      const normalized = phones
        .map((phone) => String(phone).trim())
        .filter(Boolean)
        .map((phone) => phone.replace(/\D/g, ""));
      if (!normalized.length) return [];

      const placeholders = normalized.map(() => "?").join(",");
      const rows = db.prepare(`SELECT * FROM users WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') IN (${placeholders})`).all(...normalized);
      return rows;
    },

    searchUsersByUsernameOrPhone: (query) => {
      const normalized = String(query || "").trim();
      if (!normalized) return [];
      const like = `%${normalized}%`;
      return db.prepare(`
        SELECT * FROM users
        WHERE username LIKE ? OR full_name LIKE ? OR phone LIKE ?
        ORDER BY full_name COLLATE NOCASE, username COLLATE NOCASE
        LIMIT 20
      `).all(like, like, like);
    },

    findUserById: (id) => {
      return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    },

    findUserByOAuthId: (oauthProvider, oauthId) => {
      return db.prepare("SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?").get(oauthProvider, oauthId);
    },

    createUserWithEmailPassword: (email, password, fullName, options = {}) => {
      const id = randomUUID();
      const passwordHash = bcrypt.hashSync(password, saltRounds);
      const now = Date.now();
      const phone = options.phone || null;
      const username = options.username || null;

      const stmt = db.prepare(`
        INSERT INTO users (id, email, phone, username, password_hash, full_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, email, phone, username, passwordHash, fullName, now, now);
      return { id, email, phone, username, full_name: fullName };
    },

    createUserWithPhonePassword: (phone, password, fullName, options = {}) => {
      const id = randomUUID();
      const passwordHash = bcrypt.hashSync(password, saltRounds);
      const now = Date.now();
      const username = options.username || null;
      const email = options.email || null;

      const stmt = db.prepare(`
        INSERT INTO users (id, email, phone, username, password_hash, full_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, email, phone, username, passwordHash, fullName, now, now);
      return { id, email, phone, username, full_name: fullName };
    },

    createOrUpdateUserWithOAuth: (oauthProvider, oauthData) => {
      // oauthData: { oauthId, email, fullName, profilePictureUrl }
      const existing = db.prepare("SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?").get(oauthProvider, oauthData.oauthId);

      if (existing) {
        const stmt = db.prepare(`
          UPDATE users SET email = ?, full_name = ?, profile_picture_url = ?, updated_at = ?
          WHERE id = ?
        `);
        stmt.run(oauthData.email, oauthData.fullName, oauthData.profilePictureUrl, Date.now(), existing.id);
        return { ...existing, email: oauthData.email, full_name: oauthData.fullName };
      }

      const id = randomUUID();
      const now = Date.now();
      const stmt = db.prepare(`
        INSERT INTO users (id, email, oauth_provider, oauth_id, full_name, profile_picture_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, oauthData.email, oauthProvider, oauthData.oauthId, oauthData.fullName, oauthData.profilePictureUrl, now, now);
      return { id, email: oauthData.email, oauth_provider: oauthProvider, oauth_id: oauthData.oauthId, full_name: oauthData.fullName };
    },

    verifyPassword: (user, password) => {
      if (!user || !user.password_hash) return false;
      return bcrypt.compareSync(password, user.password_hash);
    },

    updatePasswordForUser: (userId, password) => {
      const passwordHash = bcrypt.hashSync(password, saltRounds);
      const stmt = db.prepare(`
        UPDATE users
        SET password_hash = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(passwordHash, Date.now(), userId);
      return true;
    },

    createOtpVerification: ({ purpose, channel, destination, expiresAt }) => {
      const id = randomUUID();
      const code = String(randomInt(100000, 999999)).padStart(6, "0");
      const createdAt = Date.now();

      const stmt = db.prepare(`
        INSERT INTO otp_verifications (id, purpose, channel, destination, code, expires_at, verified, verified_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)
      `);

      stmt.run(id, purpose, channel, destination, code, expiresAt, createdAt);
      return { id, code, purpose, channel, destination, expiresAt };
    },

    findActiveOtpVerification: (purpose, channel, destination) => {
      return db.prepare(`
        SELECT * FROM otp_verifications
        WHERE purpose = ? AND channel = ? AND destination = ? AND verified = 0 AND expires_at > ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(purpose, channel, destination, Date.now());
    },

    verifyOtpCode: (id, code) => {
      const verification = db.prepare("SELECT * FROM otp_verifications WHERE id = ?").get(id);
      if (!verification) return null;
      if (verification.verified) return null;
      if (verification.expires_at <= Date.now()) return null;
      if (verification.code !== String(code)) return null;

      const stmt = db.prepare(`
        UPDATE otp_verifications
        SET verified = 1, verified_at = ?
        WHERE id = ?
      `);
      stmt.run(Date.now(), id);
      return { ...verification, verified: 1 };
    },

    recordToken: (token, userId, expiresAt) => {
      const stmt = db.prepare(`
        INSERT INTO auth_tokens (token, user_id, expires_at, created_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(token, userId, expiresAt, Date.now());
    },

    revokeToken: (token) => {
      const stmt = db.prepare("DELETE FROM auth_tokens WHERE token = ?");
      stmt.run(token);
    },

    isTokenRevoked: (token) => {
      const result = db.prepare("SELECT 1 FROM auth_tokens WHERE token = ?").get(token);
      return !result;
    },

    cleanupExpiredTokens: () => {
      const stmt = db.prepare("DELETE FROM auth_tokens WHERE expires_at < ?");
      stmt.run(Date.now());
    },

    getUserPublicData: (user) => {
      if (!user) return null;
      const { password_hash, oauth_id, phone, ...publicData } = user;
      return publicData;
    },

    getUserPublicDataForLookup: (user) => {
      if (!user) return null;
      const { password_hash, oauth_id, phone, ...publicData } = user;
      return publicData;
    },
  };
}
