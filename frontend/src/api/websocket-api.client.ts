import { Signal } from "../service/Signal";
import { MakeOptional } from "../util/tsutil";
import type { ClientMessage, Message, ServerMessage } from "./websocket-api.protocol";

export const DISABLE_AUTO_RECONNECT = false;

export type Msg = ServerMessage & {
  type: string;
  [key: string]: any;
};

export enum Status {
  CONNECTING = "CONNECTING",
  CONNECTED = "OPEN",
  CLOSED = "CLOSED",
};

export class WebsocketApiClient {
  private ws?: WebSocket;
  private url: string;
  private backoff = 5000;
  private maxBackoff = 10000;
  private signalMap: { [key: string]: Signal<any> } = {};
  private shouldReconnect = true;

  readonly status = new Signal<Status>(Status.CLOSED);
  readonly message = new Signal<ServerMessage | null>(null);

  constructor(url: string) {
    this.url = url;
  }

  async connect() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Connecting to", this.url);

    this.shouldReconnect = true;
    this.status.set(Status.CONNECTING);
    const ws = new WebSocket(this.url);
    ws.onopen = () => {
      this.status.set(Status.CONNECTED);
      this.backoff = 500; // reset backoff on successful connection
      this.ws = ws;
    };
    ws.onclose = () => {
      this.status.set(Status.CLOSED);
      this.rescheduleReconnect();
    };
    ws.onerror = () => {
      this.status.set(Status.CLOSED);
      ws.close();
      this.rescheduleReconnect();
    }
    ws.onmessage = event => {
      try {
        const msg: Msg = JSON.parse(event.data);
        this.message.set(msg);

        const type = msg.type;
        if (type && type in this.signalMap) this.signalMap[type].set(msg);
      } catch (e) {
        console.error("Failed to parse message", e);
        return;
      }
    }
  }

  private rescheduleReconnect() {
    if (DISABLE_AUTO_RECONNECT || !this.shouldReconnect) {
      return;
    }

    setTimeout(() => {
      this.connect();
      this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
    }, this.backoff);
  }

  send<T extends Message>(msg: T | MakeOptional<Message, 'timestamp'>) {
    const payload = JSON.stringify({
      ...msg,
      timestamp: msg.timestamp ?? Date.now(),
    } as T);
    this.ws?.readyState === WebSocket.OPEN && this.ws.send(payload);
  }

  getSignal<T = any>(name: string): Signal<T | null> {
    if (name in this.signalMap) {
      return this.signalMap[name];
    } else {
      return this.signalMap[name] = new Signal<T | null>(null);
    }
  }

  setSignalValue(name: string, value: any) {
    if (name in this.signalMap) {
      this.signalMap[name].set(value);
    }
  }

  reconnect() {
    this.ws?.close();
    this.connect();
  }

  close() {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = undefined;
    this.status.set(Status.CLOSED);
  }

  // To log out just close the connection
  open() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    this.connect();
    this.shouldReconnect = true;
  }
};
