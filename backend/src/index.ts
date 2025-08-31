import { SessionManager } from "./session";

const sessionManager: SessionManager = new SessionManager();

const WsServer = Bun.serve({
  fetch(req, server) {
    const success = server.upgrade(req);
    if (!success) {
      return new Response("Not a valid WebSocket request", { status: 400 });
    }

    return new Response(null, { status: 101 });
  },
  websocket: {
    async message(ws, msg) {
      const message = JSON.parse(msg.toString());
    },

    open(ws) {
      console.log("Client connected");
      const session = sessionManager.createSession(ws);
    },

    close(ws, code, reason) {
      console.log("Client disconnected");
      sessionManager.removeSession(ws);
    }
  },
  port: 8080,
});
