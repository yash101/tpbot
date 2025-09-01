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

import { sql, SQL } from 'bun';

const db = new SQL(process.env.DATABASE_URL || 'postgresql://tpbot:password123@pg.srv1.devya.sh/test-tpbot-0');

// Create tables
async function createTables() {
  try {
    await db.connect();
    await db`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        name VARCHAR(255) DEFAULT 'spongebob',
        role VARCHAR(50) NOT NULL DEFAULT 'guest'
      )
    `;
  } catch (e) {
    console.error('Failed to connect to database. Die.', e);
    process.exit(1);
  }
}

const ready = createTables();

export async function authenticateUser({
  username,
  password,
}: {
  username: string;
  password: string
}): Promise<{
  username: string;
  name: string;
  role: string;
} | null> {
  await ready;

  const query = await db`
    SELECT *
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;

  // our sneaky way of reset password is just set password to null via PgAdmin lol
  // our sneaky way of creating a new user is just try to login with a new username
  // this is NOT how you should do it in a real app, obviously
  if (query.length === 0 || query[0].password_hash === null) {
    const hash = await Bun.password.hash(password);
    await db`
      INSERT INTO users (username, password_hash, name, role)
      VALUES (${username}, ${hash}, 'New User', 'guest')
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash
    `;

    return {
      username,
      name: 'New User',
      role: 'guest'
    };
  }

  const user = query[0];
  if (user && await Bun.password.verify(password, user.password_hash)) {
    return {
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

  // get the current user data
  const query = await db`
    SELECT *
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;

  if (query.length === 0) {
    throw new Error('User not found');
  }

  const user = query[0];

  const updatedName = name ?? user.name;
  const updatedPasswordHash = password
    ? await Bun.password.hash(password)
    : user.password_hash;

  await db`
    UPDATE users
    SET
      name = ${updatedName},
      password_hash = ${updatedPasswordHash}
    WHERE username = ${username}
  `;
}
