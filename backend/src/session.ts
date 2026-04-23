import { WebSocket } from 'ws';
import { authenticateUser, updateUser } from "./db.js";
import { ActiveUserRole, activeRoleForClientKind, isRobot, isUser, StoredUserRole, ClientKind } from "./user.js";
import { AuthFailureResponse, AuthRequest, AuthSuccessResponse, CurrentStateMessage, ErrorMessage, ForwardMessageToRobotRequest, Message, MessageType, Robot, RobotAcquireFailureResponse, RobotAcquireRequest, RobotListRequest, RobotListResponse, RobotReleaseRequest, RobotReleaseResponse, RobotStolenByAnotherUserMessage, RobotSuccessfullyAcquiredResponse, SignalP2PAnswerRequest, SignalP2PIceCandidateRequest, SignalP2POfferRequest, SignalP2PPeerDisconnectedMessage } from './messages.js';

export class SessionManager {
  public nextSessionId: number = 69;
  public sessionByWsMap: Map<WebSocket, Session> = new Map();
  public sessionsByUserIdMap: Map<number, Session[]> = new Map();
  public sessionBySessionIdMap: Map<number, Session> = new Map();
  public robotsInUse: Map<number, number> = new Map(); // robotUserId to sessionId mapping for acquired robots
  public activeP2PConnections: Map<number, Set<number>> = new Map(); // sessionId to peer session ids mapping for active P2P connections

  public createSession(ws: WebSocket): Session {
    const session = new Session(this.nextSessionId++, ws, this);
    this.sessionBySessionIdMap.set(session.sessionId, session);
    this.sessionByWsMap.set(ws, session);
    return session;
  }

  public getSessionByWs(ws: WebSocket): Session | undefined {
    return this.sessionByWsMap.get(ws);
  }
  
  public getSessionByUserId(userId: number): Session[] | undefined {
    return this.sessionsByUserIdMap.get(userId);
  }

  public getSessionBySessionId(sessionId: number): Session | undefined {
    return this.sessionBySessionIdMap.get(sessionId);
  }

  public addP2PConnection(sessionId1: number, sessionId2: number): void {
    const peers1 = this.activeP2PConnections.get(sessionId1) ?? new Set<number>();
    peers1.add(sessionId2);
    this.activeP2PConnections.set(sessionId1, peers1);

    const peers2 = this.activeP2PConnections.get(sessionId2) ?? new Set<number>();
    peers2.add(sessionId1);
    this.activeP2PConnections.set(sessionId2, peers2);
  }

  public removeP2PConnection(sessionId1: number, sessionId2: number): void {
    const peers1 = this.activeP2PConnections.get(sessionId1);
    peers1?.delete(sessionId2);
    if (peers1?.size === 0) this.activeP2PConnections.delete(sessionId1);

    const peers2 = this.activeP2PConnections.get(sessionId2);
    peers2?.delete(sessionId1);
    if (peers2?.size === 0) this.activeP2PConnections.delete(sessionId2);
  }

  public disconnectP2PPeers(session: Session, robotUserId?: number): void {
    const peerSessionIds = [...(this.activeP2PConnections.get(session.sessionId) ?? [])];
    for (const peerSessionId of peerSessionIds) {
      const peerSession = this.getSessionBySessionId(peerSessionId);
      if (robotUserId !== undefined && peerSession?.context.user?.id !== robotUserId) continue;

      this.removeP2PConnection(session.sessionId, peerSessionId);

      if (peerSession) {
        peerSession.sendMessage<SignalP2PPeerDisconnectedMessage>({
          type: MessageType.SIGNAL_PEER_DISCONNECTED,
          timestamp: Date.now(),
          targetId: session.sessionId,
        }).catch(err => console.warn('⚠️ Failed to send peer disconnected message to peer session:', err));
      }
    }
  }

  public isAuthorizedP2PSignal(sourceSession: Session, targetSession: Session): boolean {
    if (!sourceSession.context.user || !targetSession.context.user) return false;

    if (isUser(sourceSession.context.activeRole) && isRobot(targetSession.context.activeRole)) {
      return this.robotsInUse.get(targetSession.context.user.id) === sourceSession.sessionId;
    }

    if (isRobot(sourceSession.context.activeRole) && isUser(targetSession.context.activeRole)) {
      return this.robotsInUse.get(sourceSession.context.user.id) === targetSession.sessionId;
    }

    return false;
  }

  public deleteSession(session: Session): void {
    this.disconnectP2PPeers(session);

    for (const [robotUserId, ownerSessionId] of [...this.robotsInUse.entries()]) {
      if (ownerSessionId === session.sessionId) {
        this.robotsInUse.delete(robotUserId);
      }
    }

    this.sessionByWsMap.delete(session.ws);
    this.sessionBySessionIdMap.delete(session.sessionId);

    const userId = session.context.user?.id;
    if (userId !== undefined) {
      const newSessionsForUserId = this.sessionsByUserIdMap.get(userId)
        ?.filter(s => s.sessionId !== session.sessionId) ?? [];
      if (newSessionsForUserId.length > 0) this.sessionsByUserIdMap.set(userId, newSessionsForUserId);
      else this.sessionsByUserIdMap.delete(userId);
    }
  }

  public getRobotList(): Robot[] {
    const robots: Record<number, Robot> = {};
    for (const [userId, session] of this.sessionsByUserIdMap) {
      if (!isRobot(session[0]?.context?.activeRole ?? ActiveUserRole.UNDEFINED)) continue;
      const robotUserId = session[0]!.context.user.id;

      robots[robotUserId] ??= {
        robotUserId,
        name: session[0]!.context.user.name,
        available: !this.robotsInUse.has(robotUserId),
        isControllerConnected: false,
        isVideoConnected: false,
      };

      for (const s of session) {
        switch (s.context.activeRole) {
          case ActiveUserRole.ROBOT_CONTROLLER:
            robots[robotUserId].isControllerConnected ||= true;
            break;
          case ActiveUserRole.ROBOT_VIDEO:
            robots[robotUserId].isVideoConnected ||= true;
            break;
          default: break;
        }
      }
    }

    return Object.values(robots);
  }

  public getRobotEndpointSessionIds(robotUserId: number): { controllerSessionId: number; videoSessionId: number } {
    const sessions = this.getSessionByUserId(robotUserId)?.filter(s => isRobot(s.context.activeRole)) ?? [];

    return {
      controllerSessionId: sessions.find(s => s.context.activeRole === ActiveUserRole.ROBOT_CONTROLLER)?.sessionId ?? -1,
      videoSessionId: sessions.find(s => s.context.activeRole === ActiveUserRole.ROBOT_VIDEO)?.sessionId ?? -1,
    };
  }

  public async notifyRobotControllerOfSessionIds(robotUserId: number): Promise<void> {
    const ownerSessionId = this.robotsInUse.get(robotUserId);
    if (ownerSessionId === undefined) return;

    const ownerSession = this.getSessionBySessionId(ownerSessionId);
    if (!ownerSession || !isUser(ownerSession.context.activeRole)) return;

    const robotName = this.getSessionByUserId(robotUserId)?.[0]?.context?.user?.name ?? '(unknown robot)';
    const { controllerSessionId, videoSessionId } = this.getRobotEndpointSessionIds(robotUserId);

    ownerSession.sendMessage<RobotSuccessfullyAcquiredResponse>({
      type: MessageType.ROBOT_ACQUIRE_RESPONSE,
      timestamp: Date.now(),
      robotUserId,
      controllerSessionId,
      videoSessionId,
      name: robotName,
    });
  }
}

export class Session {
  public context: Record<string, any> = {}; // kinda bodgey but should get the ball rolling for now
  private stateSendInterval: NodeJS.Timeout | null = null;

  constructor(
    public sessionId: number,
    public ws: WebSocket,
    public sessionManager: SessionManager,
  ) {
    this.stateSendInterval = setInterval(this.sendCurrentState.bind(this), 2000);
  }
  
  async onMessage(message: any) {
    // Handle incoming messages here
    console.log("Received message:", message);

    switch (message.type) {
      case MessageType.AUTH_REQUEST:
        return this.authenticate(message as AuthRequest);
      case MessageType.ROBOT_LIST_REQUEST:
        return this.getRobotList(message as RobotListRequest);
      case MessageType.ROBOT_ACQUIRE_REQUEST:
        return this.acquireRobot(message as RobotAcquireRequest);
      case MessageType.ROBOT_RELEASE_REQUEST:
        return this.releaseRobot(message as RobotReleaseRequest);
      case MessageType.FORWARD_MESSAGE_TO_ROBOT_REQUEST:
        return this.forwardMessageToRobot(message as ForwardMessageToRobotRequest);
      case MessageType.SIGNAL_P2POFFER_REQUEST:
        return this.signalP2POffer(message as SignalP2POfferRequest);
      case MessageType.SIGNAL_P2PANSWER_REQUEST:
        return this.signalP2PAnswer(message as SignalP2PAnswerRequest);
      case MessageType.SIGNAL_P2PICECANDIDATE_REQUEST:
        return this.signalP2PICECandidate(message as SignalP2PIceCandidateRequest);
      default:
        return this.sendMessage<ErrorMessage>({
          type: MessageType.ERROR,
          timestamp: Date.now(),
          error: 'Unknown message type',
        });
    }
  }

  async onClose() {
    this.sessionManager.deleteSession(this);
    this.ws.removeAllListeners();
    if (this.stateSendInterval) clearInterval(this.stateSendInterval!);
  }

  async sendMessage<T = any>(message: T): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ Attempted to send message on closed WebSocket');
    }
  }

  async authenticate(request: AuthRequest): Promise<void> {
    const user = await authenticateUser(request);
    const activeRole = user
      ? activeRoleForClientKind(user.role as StoredUserRole, request.clientKind)
      : null;

    if (!user || !activeRole) {
      return this.sendMessage<AuthFailureResponse>({
        type: MessageType.AUTH_FAILURE,
        timestamp: Date.now(),
        error: 'Invalid username, password, or client type',
      });
    }

    this.context.user = user;
    this.context.activeRole = activeRole;
    this.sessionManager.getSessionByUserId(user.id)?.push(this) ??
      this.sessionManager.sessionsByUserIdMap.set(user.id, [this]);

    if (isRobot(activeRole)) {
      this.sessionManager
        .notifyRobotControllerOfSessionIds(user.id)
        .catch(err => console.warn('⚠️ Failed to notify controlling user of robot session ids:', err));
    }

    return this.sendMessage<AuthSuccessResponse>({
      type: MessageType.AUTH_SUCCESS,
      timestamp: Date.now(),
      name: user!.name,
      role: activeRole,
    });
  }

  async updateUserInfo(request: Message): Promise<void> {
    return this.sendMessage<ErrorMessage>({
      type: MessageType.AUTH_FAILURE,
      timestamp: Date.now(),
      error: 'User info update not implemented yet (MVP)',
    });
  }

  async getRobotList(request: RobotListRequest): Promise<void> {
    if (!this.context.user) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    return this.sendMessage<RobotListResponse>({
      type: MessageType.ROBOT_LIST_RESPONSE,
      timestamp: Date.now(),
      robots: this.sessionManager.getRobotList(),
    });
  }

  async acquireRobot(request: RobotAcquireRequest): Promise<void> {
    if (!this.context.user || !isUser(this.context.activeRole)) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    const currentOwnerSessionId = this.sessionManager.robotsInUse.get(request.robotUserId);
    if (currentOwnerSessionId !== undefined && currentOwnerSessionId !== this.sessionId && !request.steal) {
      return this.sendMessage<RobotAcquireFailureResponse>({
        type: MessageType.ROBOT_ACQUIRE_RESPONSE,
        timestamp: Date.now(),
        error: 'Robot is currently in use',
      });
    }
    else if (request.steal === true && currentOwnerSessionId !== undefined && currentOwnerSessionId !== this.sessionId) {
      // Notify the previous session that their robot was stolen
      const previousSession = this.sessionManager.getSessionBySessionId(currentOwnerSessionId);
      previousSession
        ?.sendMessage<RobotStolenByAnotherUserMessage>({
          type: MessageType.ROBOT_STOLEN_MESSAGE,
          timestamp: Date.now(),
          robotUserId: request.robotUserId,
        })
        .catch(err => console.warn('⚠️ Failed to send robot stolen message to previous session:', err));
      if (previousSession) this.sessionManager.disconnectP2PPeers(previousSession, request.robotUserId);
      this.sessionManager.robotsInUse.delete(request.robotUserId);
    }

    // Get sessions for the robot
    const sessions = this.sessionManager.getSessionByUserId(request.robotUserId)
      ?.filter(s => isRobot(s.context.activeRole)) ?? [];
    if (sessions.length === 0) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Robot is not connected',
      });
    }

    this.sessionManager.robotsInUse.set(request.robotUserId, this.sessionId);

    return this.sendMessage<RobotSuccessfullyAcquiredResponse>({
      type: MessageType.ROBOT_ACQUIRE_RESPONSE,
      timestamp: Date.now(),
      robotUserId: request.robotUserId,
      ...this.sessionManager.getRobotEndpointSessionIds(request.robotUserId),
      name: sessions[0]?.context?.user?.name ?? '(unknown robot)'
    });
  }

  async releaseRobot(request: RobotReleaseRequest): Promise<void> {
    const userId = this.context.user?.id;
    if (userId === undefined || !isUser(this.context.activeRole)) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    if (this.sessionManager.robotsInUse.get(request.robotUserId) !== this.sessionId) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'You do not currently have control of this robot',
      });
    }

    this.sessionManager.robotsInUse.delete(request.robotUserId);
    this.sessionManager.disconnectP2PPeers(this, request.robotUserId);

    return this.sendMessage<RobotReleaseResponse>({
      type: MessageType.ROBOT_RELEASE_RESPONSE,
      timestamp: Date.now(),
      robotUserId: request.robotUserId,
    });
  }

  async forwardMessageToRobot(request: Message): Promise<void> {
    if (!this.context.user) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    return this.sendMessage<ErrorMessage>({
      type: MessageType.ERROR,
      timestamp: Date.now(),
      error: 'Forwarding messages to robot not implemented yet (MVP)',
    });
  }

  async signalP2POffer(request: SignalP2POfferRequest): Promise<void> {
    // auth guard
    if (!this.context.user) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    const targetSession = this.sessionManager.getSessionBySessionId(request.targetId);
    if (!targetSession || !this.sessionManager.isAuthorizedP2PSignal(this, targetSession)) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Invalid or unauthorized signaling target',
      });
    }

    this.sessionManager.addP2PConnection(this.sessionId, targetSession.sessionId);
    return targetSession.sendMessage<SignalP2POfferRequest>({
      type: MessageType.SIGNAL_P2POFFER_REQUEST,
      timestamp: Date.now(),
      targetId: this.sessionId,
      offer: request.offer,
    });
  }

  async signalP2PAnswer(request: SignalP2PAnswerRequest): Promise<void> {
    // auth guard
    if (!this.context.user) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    const targetSession = this.sessionManager.getSessionBySessionId(request.targetId);
    if (!targetSession || !this.sessionManager.isAuthorizedP2PSignal(this, targetSession)) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Invalid or unauthorized signaling target',
      });
    }

    this.sessionManager.addP2PConnection(this.sessionId, targetSession.sessionId);
    return targetSession.sendMessage<SignalP2PAnswerRequest>({
      type: MessageType.SIGNAL_P2PANSWER_REQUEST,
      timestamp: Date.now(),
      targetId: this.sessionId,
      answer: request.answer,
    });
  }

  async signalP2PICECandidate(request: SignalP2PIceCandidateRequest): Promise<void> {
    // auth guard
    if (!this.context.user) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Unauthorized',
      });
    }

    const targetSession = this.sessionManager.getSessionBySessionId(request.targetId);
    if (!targetSession || !this.sessionManager.isAuthorizedP2PSignal(this, targetSession)) {
      return this.sendMessage<ErrorMessage>({
        type: MessageType.ERROR,
        timestamp: Date.now(),
        error: 'Invalid or unauthorized signaling target',
      });
    }

    return targetSession.sendMessage<SignalP2PIceCandidateRequest>({
      type: MessageType.SIGNAL_P2PICECANDIDATE_REQUEST,
      timestamp: Date.now(),
      targetId: this.sessionId,
      candidate: request.candidate,
    });
  }

  async sendCurrentState(): Promise<void> {
    return this.sendMessage<CurrentStateMessage>({
      type: MessageType.CURRENT_STATE,
      timestamp: Date.now(),
      authenticated: Boolean(this.context.user),
      userName: this.context.user?.name,
      userRole: this.context.activeRole,
      robotUserId: isRobot(this.context.activeRole) ? this.context.user.id : undefined,
    });
  }
}
