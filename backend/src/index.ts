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
    async message(ws, msg: string | Buffer) {
      let message: any;

      // Normalize and safely parse JSON
      try {
        const msgStr = Buffer.isBuffer(msg) ? msg.toString('utf8') : msg;
        message = JSON.parse(msgStr);
      } catch (err) {
        console.warn('⚠️ Invalid JSON received:', err);
        ws.close(1003, 'Invalid JSON'); // 1003 = unsupported data
        return;
      }

      // Now handle the session
      const session = sessionManager.getSessionByWs(ws);
      if (session) {
        session.onMessage2(message);
      } else {
        console.warn("⚠️ Received message for unknown session");
        ws.close(1008, "Unknown session"); // 1008 = policy violation
      }
    },

    open(ws) {
      console.log("Client connected");
      const session = sessionManager.createSession(ws);
    },

    close(ws, code, reason) {
      console.log("Client disconnected");
      sessionManager.removeSession(sessionManager.getSessionByWs(ws)!);
    }
  },
  port: 8080,
});
