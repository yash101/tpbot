import { authenticateUser, updateUser } from "./db";
import { UserRole } from "./user";

export class SessionManager {
  private sessions = new Map<string, Session>();
  private wsToSession = new Map<Bun.ServerWebSocket<unknown>, string>();
  private idCounter = 0;
  private robots = new Map<string, Session>(); // Map of robotId to Session

  createSession(socket: Bun.ServerWebSocket<unknown>): Session {
    const sessionId = `session-${this.idCounter++}`;
    const session = new Session(this);
    session.ws = socket;
    
    this.sessions.set(sessionId, session);
    this.wsToSession.set(socket, sessionId);

    return session;
  }

  getSessionById(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
  
  getSessionByWs(ws: Bun.ServerWebSocket<unknown>): Session | undefined {
    const sessionId = this.wsToSession.get(ws);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return undefined;
  }

  removeSession(session: Session) {
    this.sessions.delete(session.sessionId);
    if (session.ws) {
      this.wsToSession.delete(session.ws);
    }
    if (session.robotId) {
      this.robots.delete(session.robotId);
    }
  }

  getRobotSession(robotId: string): Session | undefined {
    return this.robots.get(robotId);
  }
  
  registerRobotSession(robotId: string, session: Session) {
    this.robots.set(robotId, session);
  }

  getRobots(): Map<string, Session> {
    return this.robots;
  }
}

export class Session {
  sessionManager: SessionManager;
  sessionId: string;
  ws: Bun.ServerWebSocket<unknown> | null = null;

  username: string | null = null;
  name: string = 'New User';
  role: string = 'guest';
  robotId: string | null = null;
  controlledRobot: string | null = null;
  canRequestControl: boolean = true; // New property to manage control request ability

  closeCallbacks: ((s: Session) => void)[] = [];

  constructor(sessionManager: SessionManager, sessionId?: string) {
    this.sessionManager = sessionManager;
    this.sessionId = sessionId || `session-${Date.now()}`;
  }

  send(data: any) {
    if (this.ws) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async onMessage2(message: any) {
    switch (message.type) {
      case 'ping':
        this.send({ type: 'pong', timestamp: Date.now() });
        break;
      case 'user:auth':
        // Handle authentication
        // check if already authenticated
        if (this.username) {
          this.send({
            type: 'user:auth',
            success: true,
            name: this.name,
            role: this.role
          });
          return;
        }

        const { username, password } = message;
        let user;
        try {
          user = await authenticateUser({ username, password });
        } catch (e) {
          console.error("Authentication error:", e);
          this.send({
            type: 'user:auth',
            success: false
          });
          return;
        }

        if (user) {
          this.username = user.username;
          this.name = user.name;
          this.role = user.role;
          this.canRequestControl =    // Make this a DB column?
            [UserRole.ADMIN, UserRole.USER].includes(user.role as UserRole);

          this.send({
            type: 'user:auth',
            success: true,
            name: this.name,
            role: this.role
          });
        } else {
          this.send({
            type: 'user:auth',
            success: false
          });
        }
        break;
      default: break;
    }

    // Ensure the user is authenticated for other message types
    if (!this.username) {
      this.send({
        type: message.type,
        success: false,
        error: 'Not authenticated'
      });
      this.close();
      return;
    }

    // Handle user updates
    if (message.type === 'user:update') {
      // Handle user update
      try {
        await updateUser({
          username: this.username,
          name: message.name,
          password: message.password
        });
        this.send({
          type: 'user:update',
          success: true
        });
      } catch (e) {
        console.error("Error updating user:", e);
        this.send({
          type: 'user:update',
          success: false
        });
      }
    }

    // Handle the roles
    switch (this.role) {
      case UserRole.ADMIN:
        // Admin can do everything
        break;
      case UserRole.USER:
        // Operator can control robots but not manage users
        break;
      case UserRole.GUEST:
        // Viewer can only view telemetry
        break;
      case UserRole.LLBE:
        // LLBE can only send telemetry
        break;
    }
  }

  async handleAdminMessage(message: any) {
    switch (message.type) {
      case 'robot:list':
        // Return list of connected robots
        const robots = Array.from(this.sessionManager.getRobots().keys());
        this.send({
          type: 'robot:list',
          robots
        });
        break;
      case 'user:list':
        this.send({
          type: 'user:list',
          users: [],
          error: 'Not implemented / likely will never be implemented. Just update the DB directly',
        });
        break;
      case 'robot:assign':
        // Assign a robot to a user
        const { robotId, username } = message;
        // TODO
        break;
      case 'robot:unassign':
        break;
      case 'robot:current_info':
        // Send current info about a robot
        break;
      case 'user:active_list':
        // Send list of currently active users
        break;
      case 'user:assign_party':
        // Assign a user to a party
        break;
      default:
        console.warn("Unknown admin message type:", message.type);
        break;
    }
  }

  async handleLLBEMessage(message: any) {
    switch (message.type) {
      case 'robot:telemetry':
        break;
      case 'robot:status': // LLBE sends updates about connected robots
        break;
      case 'robot:login':
        break;
      case 'robot:logout':
        break;
      default:
        console.warn("Unknown LLBE message type:", message.type);
        break;
    }
  }

  async handleUserMessage(message: any) {
    switch (message.type) {
      case 'control:request':
        console.log(`Control request for robot by user ${this.username}`);
        break;
      case 'control:release':
        console.log(`Control release for robot by user ${this.username}`);
        break;
      case 'webrtc:sdp':
        // Handle SDP message
        break;
      case 'webrtc:ice':
        // Handle ICE candidate message
        break;
      default:
        console.warn("Unknown user message type:", message.type);
        break;
    }
  }

  async onMessage(data: string | Buffer<ArrayBufferLike>) {
    const message = JSON.parse(data.toString());
    console.info("Received message from client:", message);

    if (message.type === 'user:auth') {
      // Handle authentication
      const { username, password } = message;
      let user;
      try {
        user = await authenticateUser({ username, password });
      } catch (e) {
        console.error("Authentication error:", e);
        this.send({
          type: 'auth',
          success: false
        });
        return;
      }
      if (user) {
        this.username = user.username;
        this.name = user.name;
        this.role = user.role;
        this.canRequestControl =    // Make this a DB column?
          [UserRole.ADMIN, UserRole.USER].includes(user.role as UserRole);

        if (this.role === UserRole.ROBOT_LAPTOP) {
          // this.robotId = 
        }

        this.send({
          type: 'auth',
          success: true,
          name: this.name,
          role: this.role
        });
      } else {
        this.send({
          type: 'auth',
          success: false
        });
      }
    }

    // Ensure the user is authenticated for other message types
    if (!this.username) {
      this.send({
        type: message.type,
        success: false,
        error: 'Not authenticated'
      });
      this.close();
      return;
    }

    // Handle different message types
    switch (message.type) {
      case 'user:update':
        // Handle user update
        try {
          await updateUser(message);
          this.send({ type: 'user:update', success: true });
        } catch (e) {
          console.error("Error updating user:", e);
          this.send({ type: 'user:update', success: false });
        }
        break;
      case 'ping':
        this.send({ type: 'pong' });
        break;
      case 'robot:telemetry': // Acceptable: LLBE
        if (this.role !== 'llbe') {
          this.send({
            type: 'robot:telemetry',
            success: false,
            error: 'Not authorized'
          });
          this.close();
          return;
        }
        
        // Handle telemetry data
        const robotId = message.robotId;
        const data = message.data;
        
        // TODO: handle the telemetry data from the robot

        console.log(`Telemetry from robot ${robotId}:`, data);
        break;
      case 'control:request':
        console.log(`Control request for robot by user ${this.username}`);

        // 1. Check if permissions
        if (!this.canRequestControl) {
          return this.send({
            type: 'control:request',
            success: false,
            error: 'Not authorized'
          });
        }

        // 2. Check if robot is already controlled
        if (this.controlledRobot) {
          this.send({
            type: 'control:request',
            success: true,
            error: 'Already controlling a robot'
          });
          return;
        }

        break;
      case 'control:release':
        console.log(`Control release for robot by user ${this.username}`);
        break;
      case 'webrtc:sdp':
        // Handle SDP message
        break;
      case 'webrtc:ice':
        // Handle ICE candidate message
        break;
      default:
        console.warn("Unknown message type:", message.type);
        break;
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    for (const cb of this.closeCallbacks) {
      cb(this);
    }
  }

  onCloseCleanup(cb: (s: Session) => void) {
    this.closeCallbacks.push(cb);
  }
}
