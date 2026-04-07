/**
 * STOMP 1.1 server over raw WebSocket (ws library)
 * Provides full compatibility with the SockJS+STOMP frontend.
 *
 * Supported STOMP commands:
 *   CONNECT, SUBSCRIBE, UNSUBSCRIBE, SEND, DISCONNECT
 *
 * Supported destinations:
 *   /topic/*          — broadcast to all subscribers
 *   /user/queue/*     — private to a specific user (username)
 *   /app/*            — message handling (game actions via WS)
 */

const WebSocket = require('ws');
const { verifyToken } = require('../services/jwtService');

// subscriptions: Map<destination, Set<ws>>
const subscriptions = new Map();
// userSockets: username -> Set<ws>
const userSockets = new Map();
// wsInfo: ws -> { username, subscriptions: Set<destination> }
const wsInfo = new WeakMap();

function parseFrame(raw) {
  const lines = raw.split('\n');
  const command = lines[0].trim();
  const headers = {};
  let i = 1;
  while (i < lines.length && lines[i].trim() !== '') {
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx !== -1) {
      const key = lines[i].substring(0, colonIdx).trim();
      const val = lines[i].substring(colonIdx + 1).trim();
      headers[key] = val;
    }
    i++;
  }
  // Body is everything after the blank line, up to null byte
  const bodyStart = raw.indexOf('\n\n');
  let body = bodyStart !== -1 ? raw.substring(bodyStart + 2) : '';
  body = body.replace(/\x00$/, '').trim();
  return { command, headers, body };
}

function buildFrame(command, headers = {}, body = '') {
  let frame = `${command}\n`;
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\n`;
  }
  frame += `\n${body}\x00`;
  return frame;
}

function sendToTopic(destination, data) {
  const subs = subscriptions.get(destination);
  if (!subs) return;
  const body = JSON.stringify(data);

  console.log(`[STOMP] Broadcasting to ${destination}:`, body.length > 100 ? body.substring(0, 100) + '...' : body);

  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      const info = wsInfo.get(ws);
      const subId = (info && info.subscriptionMap) ? info.subscriptionMap.get(destination) : 'sub-0';
      
      const frame = buildFrame('MESSAGE', {
        destination,
        'content-type': 'application/json',
        'message-id': Date.now().toString(),
        subscription: subId || 'sub-0',
      }, body);
      ws.send(frame);
    }
  }
}

function sendToUser(username, queueDest, data) {
  const sockets = userSockets.get(username);
  if (!sockets || sockets.size === 0) {
    console.warn(`[STOMP-USER] No open sockets for user '${username}' to deliver ${queueDest}`);
    return;
  }
  const body = JSON.stringify(data);

  // Normalize: strip leading /queue -> /user/queue for lookup
  const normalizedDest = queueDest.startsWith('/user/') ? queueDest : `/user/queue${queueDest.replace(/^\/queue/, '')}`;

  for (const ws of sockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const info = wsInfo.get(ws);
    if (!info) continue;

    // Try all possible key variants to find correct subscription ID
    const subscriptionId =
      (info.subscriptionMap && (
        info.subscriptionMap.get(queueDest) ||
        info.subscriptionMap.get(normalizedDest) ||
        info.subscriptionMap.get(`/user/${username}${queueDest}`) ||
        info.subscriptionMap.get(`/user/queue${queueDest.replace(/^\/queue/, '')}`)
      )) || 'sub-private';

    console.log(`[STOMP-USER] Sending to ${username} on ${queueDest} (sub: ${subscriptionId})`);

    const frame = buildFrame('MESSAGE', {
      destination: normalizedDest,
      'content-type': 'application/json',
      'message-id': Date.now().toString(),
      subscription: subscriptionId,
    }, body);
    ws.send(frame);
  }
}

function subscribe(ws, id, destination) {
  if (!subscriptions.has(destination)) {
    subscriptions.set(destination, new Set());
  }
  subscriptions.get(destination).add(ws);

  const info = wsInfo.get(ws);
  if (info) {
    info.subscribedDestinations.add(destination);
    if (!info.subscriptionMap) info.subscriptionMap = new Map();
    // Store the original destination key
    info.subscriptionMap.set(destination, id);

    // Ensure both /user/queue/X and /queue/X map to the same subscription ID
    if (destination.startsWith('/user/') && info.username) {
      // Strip /user/<username> prefix if present
      const stripped1 = destination.replace(`/user/${info.username}`, '');
      if (stripped1 !== destination) info.subscriptionMap.set(stripped1, id);
      // Strip just /user prefix (for /user/queue/X -> /queue/X)
      const stripped2 = destination.replace(/^\/user/, '');
      if (stripped2 !== destination) info.subscriptionMap.set(stripped2, id);
    } else if (!destination.startsWith('/user/') && !destination.startsWith('/topic/')) {
      // It's a /queue/X destination, also store /user/queue/X
      info.subscriptionMap.set(`/user${destination}`, id);
    }
  }
}

function unsubscribeAll(ws) {
  const info = wsInfo.get(ws);
  if (!info) return;

  for (const dest of info.subscribedDestinations) {
    const subs = subscriptions.get(dest);
    if (subs) subs.delete(ws);
  }

  if (info.username) {
    const userSet = userSockets.get(info.username);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) userSockets.delete(info.username);
    }
  }
}

function createStompServer(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Initialize ws info
    wsInfo.set(ws, {
      username: null,
      subscribedDestinations: new Set(),
      subscriptionMap: new Map(),
    });

    ws.on('message', async (raw) => {
      const data = raw.toString();
      if (!data.trim()) return;

      let frame;
      try {
        frame = parseFrame(data);
      } catch (e) {
        return;
      }

      const { command, headers, body } = frame;

      switch (command) {
        case 'CONNECT':
        case 'STOMP': {
          // Authenticate via token header if present
          let username = null;
          const token = headers['login'] || headers['Authorization'] || headers['authorization'];
          if (token && token !== 'guest') {
            try {
              const cleanToken = token.replace(/^Bearer\s+/i, '');
              const decoded = verifyToken(cleanToken);
              username = decoded.sub;
            } catch (_) {}
          }

          const info = wsInfo.get(ws);
          if (info && username) {
            info.username = username;
            if (!userSockets.has(username)) userSockets.set(username, new Set());
            userSockets.get(username).add(ws);
          }

          ws.send(buildFrame('CONNECTED', {
            version: '1.1',
            'heart-beat': '0,0',
            server: 'SpyGame-Node/1.0',
          }));
          break;
        }

        case 'SUBSCRIBE': {
          const id = headers['id'] || 'sub-0';
          const dest = headers['destination'];
          if (dest) subscribe(ws, id, dest);
          break;
        }

        case 'UNSUBSCRIBE': {
          const id = headers['id'];
          const info = wsInfo.get(ws);
          if (info && id) {
            for (const [dest, subId] of (info.subscriptionMap || new Map())) {
              if (subId === id) {
                const subs = subscriptions.get(dest);
                if (subs) subs.delete(ws);
                info.subscribedDestinations.delete(dest);
                break;
              }
            }
          }
          break;
        }

        case 'SEND': {
          const dest = headers['destination'];
          if (!dest) break;

          let payload = {};
          try { payload = JSON.parse(body); } catch (_) {}

          // Handle /app/* messages (game WS actions)
          if (dest.startsWith('/app/')) {
            const info = wsInfo.get(ws);
            const username = info?.username;

            if (dest.startsWith('/app/game.sendMessage/')) {
              const roomId = dest.split('/app/game.sendMessage/')[1];
              const { getRoomService } = require('../services/roomService');
              const players = await require('../services/roomService').getPlayersInRoom(roomId).catch(() => []);
              const sender = payload.sender || payload.content;
              const isMember = players.some(p => p.displayName === sender || p.username === sender || p.username === username);
              if (isMember) {
                sendToTopic(`/topic/room/${roomId}`, payload);
              }
            } else if (dest.startsWith('/app/game.addUser/')) {
              const roomId = dest.split('/app/game.addUser/')[1];
              const players = await require('../services/roomService').getPlayersInRoom(roomId).catch(() => []);
              const sender = payload.sender || username;
              const isMember = players.some(p => p.displayName === sender || p.username === sender || p.username === username);
              if (isMember) {
                const joinMsg = { ...payload, type: 'JOIN', content: `${sender} joined!` };
                sendToTopic(`/topic/room/${roomId}`, joinMsg);
              }
            }
          }
          break;
        }

        case 'DISCONNECT': {
          unsubscribeAll(ws);
          ws.send(buildFrame('RECEIPT', { 'receipt-id': headers['receipt'] || '0' }));
          break;
        }

        default:
          break;
      }
    });

    ws.on('close', () => {
      unsubscribeAll(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      unsubscribeAll(ws);
    });
  });

  console.log('[WebSocket] STOMP server ready at /ws');
}

module.exports = { createStompServer, sendToTopic, sendToUser };
