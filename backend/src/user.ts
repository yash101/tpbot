export enum StoredUserRole {
  USER = 'user',
  ROBOT = 'robot',
  NEW = 'new', // MVP: user will get registered but change their role using pgadmin lol
};

export enum ActiveUserRole {
  USER = StoredUserRole.USER,
  ROBOT_CONTROLLER = 'robot_controller',
  ROBOT_VIDEO = 'robot_video',
  UNDEFINED = 'undefined', // for users that haven't authenticated yet
}

export enum ClientKind {
  WEB = 'web',
  ROBOT_CONTROLLER = 'robot_controller',
}

export function activeRoleForClientKind(storedRole: StoredUserRole, clientKind: ClientKind): ActiveUserRole | null {
  if (clientKind === ClientKind.ROBOT_CONTROLLER && storedRole === StoredUserRole.ROBOT) return ActiveUserRole.ROBOT_CONTROLLER;
  if (clientKind === ClientKind.WEB && storedRole === StoredUserRole.ROBOT) return ActiveUserRole.ROBOT_VIDEO;
  if (clientKind === ClientKind.WEB && storedRole === StoredUserRole.USER) return ActiveUserRole.USER;

  return null;
}

export function isUser(role: ActiveUserRole): boolean {
  return role === ActiveUserRole.USER;
}

// For simplicity, don't discriminate between robot controller and video node
// both can send/receive same messages but have different behavior
export function isRobot(role: ActiveUserRole): boolean {
  return role === ActiveUserRole.ROBOT_CONTROLLER || role === ActiveUserRole.ROBOT_VIDEO;
}
