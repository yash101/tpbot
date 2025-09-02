import { Signal } from "./Signal";
import { UserRole } from "./types";

export const DISABLE_AUTO_RECONNECT = true;

export type Msg = {
  type: string;
  [key: string]: any;
};

export enum Status {
  CONNECTING = "CONNECTING",
  CONNECTED = "OPEN",
  CLOSED = "CLOSED",
};

export class RealtimeClient {
  private ws?: WebSocket;
  private url: string;
  private backoff = 500;
  private maxBackoff = 10000;
  private signalMap: { [key: string]: Signal<any> } = {};

  readonly assignedParty = new Signal<string | null>(null);
  readonly assignedRobot = new Signal<string | null>(null);

  readonly linkStats = new Signal<{
    snr: number;
    retrans: number;
    rssi: number;
  }>({
    snr: 0,
    retrans: 0,
    rssi: 0,
  });

  readonly status = new Signal<Status>(Status.CLOSED);

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    console.log("Connecting to", this.url);

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
        console.log('rx: ', event.data);

        const type = msg.type;
        if (type && type in this.signalMap) {
          this.signalMap[type].set(msg);
        } else {
          console.debug("⚠️ No signal for message type", type, msg);
        }
      } catch (e) {
        console.error("Failed to parse message", e);
        return;
      }
    }
  }

  private rescheduleReconnect() {
    if (DISABLE_AUTO_RECONNECT) {
      return;
    }

    setTimeout(() => {
      this.connect();
      this.backoff = Math.min(this.backoff * 2, this.maxBackoff);
    }, this.backoff);
  }

  send(msg: Msg) {
    const payload = JSON.stringify(msg);
    console.log('tx: ', payload);
    console.log("Sending message", msg);
    this.ws?.readyState === WebSocket.OPEN && this.ws.send(payload);
  }

  getSignal(name: string): Signal<any> {
    if (name in this.signalMap) {
      return this.signalMap[name];
    } else {
      return this.signalMap[name] = new Signal<any>(null);
    }
  }

  reconnect() {
    this.ws?.close();
    this.connect();
  }
};
