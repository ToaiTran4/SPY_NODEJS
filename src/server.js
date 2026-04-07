require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDb } = require('./config/db');
const { createStompServer, sendToTopic, sendToUser } = require('./websocket/stompServer');
const gameService = require('./services/gameService');
const roomService = require('./services/roomService');
const timerService = require('./services/timerService');

const PORT = process.env.PORT || 3000;

async function main() {
  // Connect to MongoDB
  await connectDb();

  // Create HTTP server
  const server = http.createServer(app);

  // STOMP WebSocket server
  const stompBroadcast = { sendToTopic, sendToUser };
  createStompServer(server);

  // Inject STOMP broadcaster into game and room services
  gameService.setIo(stompBroadcast);
  roomService.setIo(stompBroadcast);
  timerService.setGameService(gameService);

  server.listen(PORT, () => {
    console.log(`[Server] Spy Game Backend (Node.js) running on port ${PORT}`);
    console.log(`[Server] WebSocket STOMP endpoint: ws://localhost:${PORT}/ws`);
    console.log(`[Server] REST API: http://localhost:${PORT}/api`);
  });
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
