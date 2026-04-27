import { ActiveUserRole, ClientKind } from "../../../backend/src/user"
import {
  MessageType,
  type AuthFailureResponse,
  type AuthRequest,
  type AuthSuccessResponse,
  type ErrorMessage,
  type ForwardMessageToRobotRequest,
  type Message,
  type Robot,
  type RobotAcquireFailureResponse,
  type RobotPeerAssignedMessage,
  type RobotAcquireRequest,
  type RobotListRequest,
  type RobotListResponse,
  type RobotReleaseRequest,
  type RobotReleaseResponse,
  type RobotStolenByAnotherUserMessage,
  type RobotSuccessfullyAcquiredResponse,
  type SignalP2PAnswerRequest,
  type SignalP2PIceCandidateRequest,
  type SignalP2POfferRequest,
  type SignalP2PPeerDisconnectedMessage,
  type SignalP2PPeerReady,
} from "../../../backend/src/messages"

export { ActiveUserRole, ClientKind, MessageType }
export type {
  AuthFailureResponse,
  AuthRequest,
  AuthSuccessResponse,
  ErrorMessage,
  ForwardMessageToRobotRequest,
  Message,
  Robot,
  RobotAcquireFailureResponse,
  RobotPeerAssignedMessage,
  RobotAcquireRequest,
  RobotListRequest,
  RobotListResponse,
  RobotReleaseRequest,
  RobotReleaseResponse,
  RobotStolenByAnotherUserMessage,
  RobotSuccessfullyAcquiredResponse,
  SignalP2PAnswerRequest,
  SignalP2PIceCandidateRequest,
  SignalP2POfferRequest,
  SignalP2PPeerDisconnectedMessage,
  SignalP2PPeerReady,
}

export type ClientMessage =
  | AuthRequest
  | RobotListRequest
  | RobotAcquireRequest
  | RobotReleaseRequest
  | ForwardMessageToRobotRequest
  | SignalP2POfferRequest
  | SignalP2PAnswerRequest
  | SignalP2PIceCandidateRequest

export type ServerMessage =
  | AuthSuccessResponse
  | AuthFailureResponse
  | RobotListResponse
  | RobotSuccessfullyAcquiredResponse
  | RobotAcquireFailureResponse
  | RobotPeerAssignedMessage
  | RobotReleaseResponse
  | RobotStolenByAnotherUserMessage
  | SignalP2POfferRequest
  | SignalP2PAnswerRequest
  | SignalP2PIceCandidateRequest
  | SignalP2PPeerDisconnectedMessage
  | SignalP2PPeerReady
  | ErrorMessage

export type ProtocolMessage = ClientMessage | ServerMessage | Message

export function nowMessageBase() {
  return { timestamp: Date.now() }
}
