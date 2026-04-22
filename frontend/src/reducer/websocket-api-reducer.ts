import {
  ActiveUserRole,
  AuthSuccessResponse,
  Message,
  MessageType,
  RobotSuccessfullyAcquiredResponse
} from "../api/websocket-api.protocol";

export interface WebsocketApiState {
  connected: boolean;
  authenticated: boolean;
  username: string | null;
  role: ActiveUserRole | null;
  hasRobotControl: boolean;
  robotUserId: number | null;
}

export const initialWebsocketApiState: WebsocketApiState = {
  connected: false,
  authenticated: false,
  username: null,
  role: null,
  hasRobotControl: false,
  robotUserId: null,
};

export function reduce(s: WebsocketApiState, a: Message): WebsocketApiState {
  const ns = _reduce(s, a);
  if (s !== ns) console.log("State update: ", a?.type, s, ns);
  return ns;
}

function _reduce(s: WebsocketApiState, a: Message): WebsocketApiState {
  if (!a?.type) return s;

  switch (a.type) {
    case MessageType.ERROR:
      console.error("Received error message from server:", a);
      return s;


    case MessageType.AUTH_SUCCESS:
      const authMessage: AuthSuccessResponse = a as AuthSuccessResponse;
      return {
        ...s,
        authenticated: true,
        username: authMessage.name,
        role: authMessage.role,
      };

    case MessageType.ROBOT_ACQUIRE_RESPONSE:
      return {
        ...s,
        hasRobotControl: true,
        robotUserId: (a as RobotSuccessfullyAcquiredResponse).robotUserId,
      };

    case MessageType.ROBOT_RELEASE_RESPONSE:
      return {
        ...s,
        hasRobotControl: false,
        robotUserId: null,
      };

    case MessageType.ROBOT_STOLEN_MESSAGE:
      return {
        ...s,
        hasRobotControl: false,
        robotUserId: null,
      };

    case MessageType.ROBOT_LIST_RESPONSE:
    case MessageType.CURRENT_STATE: // currently unused. I don't think we actually need to use this.
    case MessageType.AUTH_FAILURE:
    case MessageType.HELLO: // placeholder useless message, maybe used for pings
    case MessageType.FORWARD_MESSAGE_TO_ROBOT_REQUEST:
    case MessageType.SIGNAL_P2POFFER_REQUEST:
    case MessageType.SIGNAL_P2PANSWER_REQUEST:
    case MessageType.SIGNAL_P2PICECANDIDATE_REQUEST:
    case MessageType.SIGNAL_PEER_DISCONNECTED:
      return s; // these messages are handled by individual components that subscribe to them, so we don't need to do anything here

    default:
      console.warn("Unhandled message type:", a.type, a);
      return s;
  }
}
