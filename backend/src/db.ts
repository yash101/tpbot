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

const db = new SQL(process.env.DATABASE_URL!);

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
  const hash = await Bun.password.hash(password);

  const query = await db`
    SELECT *
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;

  if (query.length === 0) {
    await db`
      INSERT INTO users (username, password_hash, name, role)
      VALUES (${username}, ${hash}, 'New User', 'guest')
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
  if (!name)
    name = user.name;

  if (password) {
    password = await Bun.password.hash(password);
  } else {
    password = user.password_hash;
  }

  await db`
    UPDATE users
    SET name = ${name}, password_hash = ${password}
    WHERE username = ${username}
  `;
}
