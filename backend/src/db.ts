/**
 * Database functions, basically for user authn/authz only
 * 
 * Yeah, this is duct-taped together. About as insecure as my ex.
 * Kinda hard to hack though, but let's be honest, no one's gonna
 * bother to hack into this garbage.
 * 
 * Note: this code seems a bit less secure than it actually is.
 * This API is websocket-only, so a session needs to be fully established
 * for half this shit.
 * 
 * So modifying user data is kinda impossible, even if you're Ananay.
 * 
 * Primary vuln: login attempts automatically result in new user creation
 * as guest role. Someone can just spam user logins and blow up the DB.
 * 
 * But then if the DB blow up, containerd will just reset it anyways
 * and it'll act like my ex after she came home late last night.
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { StoredUserRole } from './user.js';

let dbUrl: string | null = process.env.DATABASE_URL || null;
// Actual semi-prod database connection string. Kinda ignore the hardcoded password ;)
dbUrl = dbUrl || 'postgresql://tpbot:password123@10.0.129.9/test-tpbot-0';

// For SpaceX demo (if it'll work)
// dbUrl = dbUrl || 'postgresql://postgres:password@localhost:5432/postgres';
const pool = new Pool({
  connectionString: dbUrl,
  max: 20, // Maximum number of connections in the pool
});

// Create tables
async function createTables() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          name VARCHAR(255) DEFAULT 'spongebob',
          role VARCHAR(50) NOT NULL DEFAULT '${StoredUserRole.NEW}'
        )
      `);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('Failed to connect to database. Die.', e);
    process.exit(1);
  }
}

const ready = createTables();

// Simple password hashing utility using Node.js crypto
async function hashPassword(password: string): Promise<string> {
  // For production, use bcrypt instead
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, 'salt', 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

export async function authenticateUser({
  username,
  password,
}: {
  username: string;
  password: string
}): Promise<{
  id: number,
  username: string;
  name: string;
  role: string;
} | null> {
  await ready;

  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1 LIMIT 1',
    [username]
  );
  const query = result.rows;

  // our sneaky way of reset password is just set password to null via PgAdmin lol
  // our sneaky way of creating a new user is just try to login with a new username
  // this is NOT how you should do it in a real app, obviously
  if (query.length === 0 || query[0].password_hash === null) {
    const hash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (username, password_hash, name, role)
        VALUES ($1, $2, 'New User', '${StoredUserRole.NEW}')
        ON CONFLICT (username) DO UPDATE
        SET password_hash = EXCLUDED.password_hash
        RETURNING id
      `,
      [username, hash]
    );

    return {
      id: query[0]?.id ?? -1, // this is a bit hacky, but we don't actually need the id for anything right now, so it doesn't matter
      username,
      name: 'New User',
      role: StoredUserRole.NEW,
    };
  }

  const user = query[0];
  if (user && await verifyPassword(password, user.password_hash)) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
  }

  return null;
}

export async function updateUser({
  username,
  name,
  password
}: {
  username: string;
  name?: string;
  password?: string;
}): Promise<void> {
  await ready;

  const client = await pool.connect();
  try {
    // get the current user data
    const result = await client.query(
      'SELECT * FROM users WHERE username = $1 LIMIT 1',
      [username]
    );
    const query = result.rows;

    if (query.length === 0) {
      throw new Error('User not found');
    }

    const user = query[0];

    const updatedName = name ?? user.name;
    const updatedPasswordHash = password
      ? await hashPassword(password)
      : user.password_hash;

    await client.query(
      `UPDATE users
       SET name = $1, password_hash = $2
       WHERE username = $3`,
      [updatedName, updatedPasswordHash, username]
    );
  } finally {
    client.release();
  }
}
