import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

export function createAuthQueries(db) {
  const saltRounds = 10;

  return {
    findUserByEmail: (email) => {
      return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    },

    findUserByPhone: (phone) => {
      return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
    },

    findUserById: (id) => {
      return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    },

    findUserByOAuthId: (oauthProvider, oauthId) => {
      return db.prepare("SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?").get(oauthProvider, oauthId);
    },

    createUserWithEmailPassword: (email, password, fullName) => {
      const id = randomUUID();
      const passwordHash = bcrypt.hashSync(password, saltRounds);
      const now = Date.now();

      const stmt = db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, email, passwordHash, fullName, now, now);
      return { id, email, full_name: fullName };
    },

    createUserWithPhonePassword: (phone, password, fullName) => {
      const id = randomUUID();
      const passwordHash = bcrypt.hashSync(password, saltRounds);
      const now = Date.now();

      const stmt = db.prepare(`
        INSERT INTO users (id, phone, password_hash, full_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, phone, passwordHash, fullName, now, now);
      return { id, phone, full_name: fullName };
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
      const { password_hash, oauth_id, ...publicData } = user;
      return publicData;
    },
  };
}
