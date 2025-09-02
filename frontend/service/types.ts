export enum UserRole {
  GUEST = 'guest',
  USER = 'user',
  ADMIN = 'admin',
  ROBOT = 'robot',
};

export type UserInfo = {
  username: string | null;
  role: UserRole | null;
  name: string | null;
}
