import { authenticateUser, updateUser } from "./db";
import { UserRole } from "./user";

export class SessionManager {
  private sessions = new Map<string, Session>();
  private wsToSession = new Map<Bun.ServerWebSocket<unknown>, string>();
  private idCounter = 0;
  private robots = new Map<string, Session>(); // Map of robotId to Session
  private llbeSession: Session | null = null; // Session for LLBE connection
  private llbeLastPing: Date | null = null; // Track last LLBE ping
  readonly parties = new Map<string, Set<Session>>(); // partyId -> set of sessions

  partyJoin(partyId: string, session: Session) {
    if (!this.parties.has(partyId)) {
      this.parties.set(partyId, new Set());
    }
    this.parties.get(partyId)!.add(session);
  }

  partyLeave(partyId: string, session: Session) {
    if (this.parties.has(partyId)) {
      this.parties.get(partyId)!.delete(session);
      if (this.parties.get(partyId)!.size === 0) {
        this.parties.delete(partyId);
      }
    }
  }

  getPartyMembers(partyId: string): Set<Session> | null {
    return this.parties.get(partyId) || null;
  }

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

  updateLlbePing() {
    this.llbeLastPing = new Date();
  }

  getLlbeLastPing(): Date | null {
    return this.llbeLastPing;
  }

  isLlbeConnected(): boolean {
    if (!this.llbeSession || !this.llbeLastPing) {
      return false;
    }
    // Consider LLBE disconnected if no ping for more than 30 seconds
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000);
    return this.llbeLastPing > thirtySecondsAgo;
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

  // Map of message type -> handler method
  private messageHandlers: Map<string, (message: any) => Promise<boolean | void>>;

  constructor(sessionManager: SessionManager, sessionId?: string) {
    this.sessionManager = sessionManager;
    this.sessionId = sessionId || `session-${Date.now()}`;

    // Bind handlers per message type
    this.messageHandlers = new Map([
      ['ping', (m) => this.handle_ping(m)],
      ['ping:resp', async (m) => true], // No-op for ping responses
      ['user:auth', (m) => this.handle_user_auth(m)],
      ['user:update', (m) => this.handle_user_update(m)],

      // WebRTC handlers
      ['webrtc:sdp', (m) => this.handle_webrtc_sdp(m)],
      ['webrtc:ice', (m) => this.handle_webrtc_ice(m)],

      // Admin handlers
      ['robot:list', (m) => this.handle_admin_robot_list(m)],
      ['user:list', (m) => this.handle_admin_user_list(m)],
      ['robot:assign', (m) => this.handle_admin_robot_assign(m)],
      ['robot:unassign', (m) => this.handle_admin_robot_unassign(m)],
      ['robot:current_info', (m) => this.handle_admin_robot_current_info(m)],
      ['user:active_list', (m) => this.handle_admin_user_active_list(m)],
      ['user:assign_party', (m) => this.handle_admin_user_assign_party(m)],

      // LLBE handlers
      ['robot:telemetry', (m) => this.handle_llbe_robot_telemetry(m)],
      ['robot:status', (m) => this.handle_llbe_robot_status(m)],
      ['robot:login', (m) => this.handle_llbe_robot_login(m)],
      ['robot:logout', (m) => this.handle_llbe_robot_logout(m)],

      // User handlers
      ['control:request', (m) => this.handle_user_control_request(m)],
      ['control:release', (m) => this.handle_user_control_release(m)],

      // Party handlers (TODO: implement)
      ['party:join', (m) => this.handle_party_join(m)],
      ['party:leave', (m) => this.handle_party_leave(m)],
      ['party:list', (m) => this.handle_party_list(m)] // Admin only?
    ]);
  }

  send(data: any) {
    if (this.ws) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async onMessage(message: any) {
    const type = message?.type;
    if (!type || typeof type !== 'string') {
      console.warn('Received message without valid type:', message);
      return;
    }

    const handler = this.messageHandlers.get(type);

    const unauthenticatedMessageTypes = new Set([
      'ping',
      'ping:resp',
      'user:auth'
    ]);

    // Allow unauthenticated handlers for ping and auth
    if (!this.username && !unauthenticatedMessageTypes.has(type)) {
      this.send({
        type,
        success: false,
        error: 'Not authenticated'
      });

      console.warn('Unauthenticated message received, closing session');
      this.close();
      return;
    }

    if (handler) {
      try {
        const handled = await handler(message);
        // If handler returns true it already routed/sent reply
        if (handled === true) return;
      } catch (e) {
        console.error('Error handling message', type, e);
        this.send({ type, success: false, error: 'Handler error' });
      }
      return;
    }

    // Unknown message type
    console.warn('Unknown message type:', type);
  }

  // --- Per-message handlers ---
  async handle_ping(message: any) {
    // Check if this ping is from LLBE by looking for LLBE-specific identifiers
    if (this === this.sessionManager.getLLBEConnection()) {
      this.sessionManager.setLlbeSession(this);
      this.sessionManager.updateLlbePing();
    }

    this.send({
      ...message,
      type: 'ping:resp',
      timestamp: Date.now(),
      incomingTimestamp: message.timestamp,
    });
    return true;
  }

  async handle_user_auth(message: any) {
    // check if already authenticated
    if (this.username) {
      this.send({ type: 'user:auth', success: true, name: this.name, role: this.role });
      return true;
    }

    const { username, password } = message;

    let user;
    try {
      user = await authenticateUser({ username, password });
    } catch (e) {
      console.error('Authentication error:', e);
      this.send({ type: 'user:auth', success: false });
      return true;
    }

    if (!user) {
      this.send({ type: 'user:auth', success: false });
      return true;
    }

    this.username = user.username;
    this.name = user.name;
    this.role = user.role;
    this.canRequestControl = [UserRole.ADMIN, UserRole.USER].includes(user.role as UserRole);

    if (user.role === UserRole.LLBE) {
      this.sessionManager.setLlbeSession(this);
    }

    this.send({ type: 'user:auth', success: true, name: this.name, role: this.role });
    return true;
  }

  async handle_user_update(message: any) {
    try {
      await updateUser({ username: this.username!, name: message.name, password: message.password });
      this.send({ type: 'user:update', success: true });
    } catch (e) {
      console.error('Error updating user:', e);
      this.send({ type: 'user:update', success: false });
    }
    return true;
  }

  // WebRTC handlers
  async handle_webrtc_sdp(message: any) {
    // If the sender is a regular user/browser and wants to talk to LLBE
    if (message?.target === 'llbe') {
      const llbeSession = this.sessionManager.getLLBEConnection();
      if (!llbeSession) {
        console.warn('No LLBE session available for webrtc:sdp');
        this.send({ type: 'webrtc:sdp', target: 'llbe', success: false, error: 'No LLBE connection available' });
        return true;
      }

      if (!message?.sdp) {
        console.warn('No SDP in webrtc:sdp message');
        this.send({ type: 'webrtc:sdp', target: 'llbe', success: false, error: 'No SDP provided' });
        return true;
      }

      llbeSession.send({ type: 'webrtc:sdp', sessionid: this.sessionId, sdp: message.sdp });
      return true;
    }

    // Message coming from LLBE
    if (this === this.sessionManager.getLLBEConnection()) {
      const targetSessionId = message?.sessionid || message?.target;
      if (!targetSessionId) {
        console.warn('LLBE sdp message missing session id/target');
        return true;
      }

      const targetSession = this.sessionManager.getSessionById(targetSessionId);
      if (!targetSession) {
        console.warn('No target session for webrtc:sdp message', targetSessionId);
        return true;
      }

      let sdpPayload = message.sdp;
      if (typeof sdpPayload === 'string') sdpPayload = { type: 'answer', sdp: sdpPayload };

      targetSession.send({ type: 'webrtc:sdp', sdp: sdpPayload, target: 'llbe' });
      return true;
    }

    console.warn('SDP message routing unsupported for this sender/target');
    return true;
  }

  async handle_webrtc_ice(message: any) {
    // From browser -> LLBE
    if (message?.target === 'llbe') {
      const llbeSession = this.sessionManager.getLLBEConnection();
      if (!llbeSession) {
        console.warn('No LLBE session available for webrtc:ice');
        this.send({ type: 'webrtc:ice', target: 'llbe', success: false, error: 'No LLBE connection available' });
        return true;
      }

      const candidateStr = message.candidate?.candidate || message.candidate || null;
      llbeSession.send({
        type: 'webrtc:ice',
        sessionid: this.sessionId,
        candidate: candidateStr,
        sdpMid: message.candidate?.sdpMid,
        sdpMLineIndex: message.candidate?.sdpMLineIndex,
      });
      return true;
    }

    // From LLBE -> browser
    if (this === this.sessionManager.getLLBEConnection()) {
      const targetSessionId = message?.sessionid || message?.target;
      if (!targetSessionId) {
        console.warn('LLBE ice message missing session id/target');
        return true;
      }

      const targetSession = this.sessionManager.getSessionById(targetSessionId);
      if (!targetSession) {
        console.warn('No target session for webrtc:ice message', targetSessionId);
        return true;
      }

      const candObj = typeof message.candidate === 'string'
        ? { candidate: message.candidate, sdpMid: message?.sdpMid, sdpMLineIndex: message?.sdpMLineIndex }
        : message.candidate;
      targetSession.send({ type: 'webrtc:ice', candidate: candObj, target: 'llbe' });
      return true;
    }

    console.warn('ICE message routing unsupported for this sender/target');
    return true;
  }

  // Admin handlers (per-message)
  async handle_admin_robot_list(message: any) {
    const robotSessions = this.sessionManager.getRobots();
    const robots = Array.from(robotSessions.entries()).map(([robotId, session]) => ({
      id: robotId,
      name: session.robotId || robotId,
      status: session.ws && session.ws.readyState === WebSocket.OPEN ? "online" : "offline",
      battery: 0, // TODO: get from telemetry
      signal: 0,  // TODO: get from telemetry  
      controller: session.controlledRobot || null,
      party: session.party || null,
      lastSeen: new Date().toISOString()
    }));

    this.send({
      type: 'robot:list',
      robots,
      llbeStatus: {
        connected: this.sessionManager.isLlbeConnected(),
        lastPing: this.sessionManager.getLlbeLastPing()?.toISOString() || null
      }
    });
    return true;
  }

  async handle_admin_user_list(message: any) {
    this.send({ type: 'user:list', users: [], error: 'Not implemented / likely will never be implemented. Just update the DB directly' });
    return true;
  }

  async handle_admin_robot_assign(message: any) {
    // Assign a robot to a user (TODO: implement)
    // Keep API surface for future implementation
    // const { robotId, username } = message;
    return true;
  }

  async handle_admin_robot_unassign(message: any) { return true; }
  async handle_admin_robot_current_info(message: any) { return true; }
  async handle_admin_user_active_list(message: any) { return true; }
  async handle_admin_user_assign_party(message: any) { return true; }

  // LLBE handlers
  async handle_llbe_robot_telemetry(message: any) { return true; }
  async handle_llbe_robot_status(message: any) { return true; }
  async handle_llbe_robot_login(message: any) { return true; }
  async handle_llbe_robot_logout(message: any) { return true; }

  async handle_party_join(message: any) {
    const { partyId } = message;
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      this.send({
        type: 'party:join',
        success: false,
        error: 'Invalid party ID'
      });
      return true;
    }

    this.party = partyId.trim();
    this.sessionManager.partyJoin(this.party, this);
    this.send({
      type: 'party:join',
      success: true,
      partyId: this.party
    });
    return true;
  }
  async handle_party_leave(message: any) {
    if (this.role === UserRole.ADMIN) {
      const { partyId, sessionId } = message;
      if (partyId && typeof partyId === 'string' && partyId.trim() !== '') {
        const targetPartyId = partyId.trim();
        const targetSession = sessionId && typeof sessionId === 'string' && sessionId.trim() !== ''
          ? this.sessionManager.getSessionById(sessionId.trim())
          : this;

        if (targetSession && targetSession.party === targetPartyId) {
          this.sessionManager.partyLeave(targetPartyId, targetSession);
          targetSession.party = null;
          targetSession.send({
            type: 'party:leave',
            success: true,
            partyId: targetPartyId
          });
        } else {
          this.send({
            type: 'party:leave',
            success: false,
            error: 'Target session not in specified party'
          });
        }
      }
    } else {
      if (this.party) {
        const party = this.party;
        this.sessionManager.partyLeave(party, this);
        this.send({
          type: 'party:leave',
          success: true,
          partyId: party,
        });

        this.party = null;
      }
    }

    return true;
  }

  async handle_party_list(message: any) {
    if (this.role !== UserRole.ADMIN) {
      this.send({
        type: 'party:list',
        success: false,
        error: 'Not authorized'
      });
      return true;
    }

    const partyInfo: { partyId: string; memberCount: number }[] = [];
    for (const [partyId, members] of this.sessionManager.parties.entries()) {
      partyInfo.push({ partyId, memberCount: members.size });
    }

    this.send({
      type: 'party:list',
      success: true,
      parties: partyInfo
    });
    return true;
  }

  // User handlers
  async handle_user_control_request(message: any) {
    console.log(`Control request for robot by user ${this.username}`);
    return true;
  }

  async handle_user_control_release(message: any) {
    console.log(`Control release for robot by user ${this.username}`);
    return true;
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
