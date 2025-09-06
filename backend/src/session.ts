import { authenticateUser, updateUser } from "./db";
import { UserRole } from "./user";

export class SessionManager {
  private sessions = new Map<string, Session>();
  private wsToSession = new Map<Bun.ServerWebSocket<unknown>, string>();
  private idCounter = 0;
  private robots = new Map<string, Session>(); // Map of robotId to Session
  private llbeSession: Session | null = null; // Session for LLBE connection

  createSession(socket: Bun.ServerWebSocket<unknown>): Session {
    const sessionId = `session-${this.idCounter++}`;
  const session = new Session(this, sessionId);
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

  getLLBEConnection(): Session | null {
    return this.llbeSession;
  }

  setLlbeSession(session: Session | null) {
    this.llbeSession = session;
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
  party: string | null = null; // Party ID for grouping users and robots

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

  async onMessage(message: any) {
    if (message.type === 'ping') {
      this.send({
        type: 'ping:resp',
        timestamp: Date.now(),
        incomingTimestamp: message.timestamp,
        ...message
      });

      return;
    } else if (message.type === 'user:auth') {
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

      const {
        username,
        password
      } = message;

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

      if (!user) {
        this.send({
          type: 'user:auth',
          success: false
        });
        return;
      }

      this.username = user.username;
      this.name = user.name;
      this.role = user.role;
      this.canRequestControl =    // Make this a DB column?
        [UserRole.ADMIN, UserRole.USER].includes(user.role as UserRole);

      if (user.role === UserRole.LLBE) {
        this.sessionManager.setLlbeSession(this);
      }

      this.send({
        type: 'user:auth',
        success: true,
        name: this.name,
        role: this.role
      });
      return;
    }

    // Ensure the user is authenticated for other message types
    if (!this.username) {
      this.send({
        type: message.type,
        success: false,
        error: 'Not authenticated'
      });
      console.warn("Unauthenticated message received, closing session");
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

    // Handle signalling messages
    if (await this.handleWebrtcMessage(message))
      return;

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

  async handleWebrtcMessage(message: any): Promise<boolean> {
    switch (message.type) {
      case 'webrtc:sdp': {
        // If the sender is a regular user/browser and wants to talk to LLBE
        if (message?.target === 'llbe') {
          const llbeSession = this.sessionManager.getLLBEConnection();
          if (!llbeSession) {
            console.warn('No LLBE session available for webrtc:sdp');
            this.send({
              type: 'webrtc:sdp',
              target: 'llbe',
              success: false,
              error: 'No LLBE connection available'
            });
            return false;
          }

          if (!message?.sdp) {
            console.warn('No SDP in webrtc:sdp message');
            this.send({
              type: 'webrtc:sdp',
              target: 'llbe',
              success: false,
              error: 'No SDP provided'
            });
            return false;
          }

          // Forward to LLBE and include the originating session id so LLBE can reply
          llbeSession.send({
            type: 'webrtc:sdp',
            sessionid: this.sessionId,
            sdp: message.sdp
          });
          return true;
        }

        // Message coming from LLBE (it will not set target='llbe' but will include sessionid)
        if (this === this.sessionManager.getLLBEConnection()) {
          const targetSessionId = message?.sessionid || message?.target;
          if (!targetSessionId) {
            console.warn('LLBE sdp message missing session id/target');
            return false;
          }

          const targetSession = this.sessionManager.getSessionById(targetSessionId);
          if (!targetSession) {
            console.warn('No target session for webrtc:sdp message', targetSessionId);
            return false;
          }

          // Normalize sdp: if LLBE sent a plain SDP string, wrap into an object the frontend expects
          let sdpPayload = message.sdp;
          if (typeof sdpPayload === 'string') {
            sdpPayload = { type: 'answer', sdp: sdpPayload };
          }

          targetSession.send({ type: 'webrtc:sdp', sdp: sdpPayload, target: 'llbe' });
          return true;
        }

        // Otherwise unsupported routing
        console.warn('SDP message routing unsupported for this sender/target');
        return false;
      }
      case 'webrtc:ice': {
        // From browser -> LLBE
        if (message?.target === 'llbe') {
          const llbeSession = this.sessionManager.getLLBEConnection();
          if (!llbeSession) {
            console.warn('No LLBE session available for webrtc:ice');
            this.send({ type: 'webrtc:ice', target: 'llbe', success: false, error: 'No LLBE connection available' });
            return false;
          }

          // Forward candidate to LLBE including originating session id
          // Normalize candidate: frontend sends object {candidate, sdpMid, sdpMLineIndex}
          const candidateStr = message.candidate?.candidate || message.candidate || null;
          llbeSession.send({
            type: 'webrtc:ice',
            sessionid: this.sessionId,
            candidate: candidateStr,
            sdpMid: message.candidate?.sdpMid,
            sdpMLineIndex: message.candidate?.sdpMLineIndex
          });
          return true;
        }

        // From LLBE -> browser
        if (this === this.sessionManager.getLLBEConnection()) {
          const targetSessionId = message?.sessionid || message?.target;
          if (!targetSessionId) {
            console.warn('LLBE ice message missing session id/target');
            return false;
          }

          const targetSession = this.sessionManager.getSessionById(targetSessionId);
          if (!targetSession) {
            console.warn('No target session for webrtc:ice message', targetSessionId);
            return false;
          }

          // Forward candidate to browser and mark the origin as 'llbe' so frontend can map pc
          const candObj = (typeof message.candidate === 'string')
            ? { candidate: message.candidate, sdpMid: message?.sdpMid, sdpMLineIndex: message?.sdpMLineIndex }
            : message.candidate;
          targetSession.send({ type: 'webrtc:ice', candidate: candObj, target: 'llbe' });
          return true;
        }

        console.warn('ICE message routing unsupported for this sender/target');
        return false;
      }
      default:
        console.warn('Unknown webrtc message type:', message.type);
        return false;
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
      default:
        console.warn("Unknown user message type:", message.type);
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
