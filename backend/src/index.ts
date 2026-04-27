import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from "./session.js";

const sessionManager: SessionManager = new SessionManager();

// Create WebSocket server listening on port 8080
const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });

console.log('WebSocket server listening on port 8080');

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  
  // Create a new session for this connection
  const session = sessionManager.createSession(ws);
  
  ws.on('message', (msg: string | Buffer) => {
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
    
    // Handle the session message
    if (session) {
      session.onMessage(message);
    } else {
      console.warn('⚠️ Received message for unknown session');
      ws.close(1008, 'Unknown session'); // 1008 = policy violation
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
    void session.onClose();
  });
  
  ws.on('error', (err: Error) => {
    console.error('WebSocket error:', err);
    void session.onClose();
  });
});
