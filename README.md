# spy-game-backend-nodejs

Node.js backend for the Spy Game — converted from Java Spring Boot.

## Tech Stack
- **Express.js** — REST API
- **ws** — WebSocket (STOMP 1.1 compatible server)
- **mongodb** — Native MongoDB driver (no Mongoose)
- **jsonwebtoken + bcryptjs** — JWT auth
- **@google/generative-ai** — Gemini AI integration
- **nodemailer** — Email

## Running Locally

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Start production server
npm start
```

Server runs at: `http://localhost:3000`  
WebSocket: `ws://localhost:3000/ws` (STOMP 1.1 compatible with SockJS frontend)

## Environment Variables

Copy `.env` and adjust as needed:

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `GEMINI_API_KEY` | Google Gemini AI API key |
| `MAIL_USER` | Gmail SMTP user |
| `MAIL_PASS` | Gmail App Password |
| `CORS_ORIGIN` | Frontend origin (e.g. http://localhost:5173) |

## Frontend Integration

Update the frontend `.env` to point to this backend:
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

## Docker

```bash
docker build -t spy-game-backend-nodejs .
docker run -p 3000:3000 --env-file .env spy-game-backend-nodejs
```
