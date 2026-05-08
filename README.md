# Chat Sentiment App

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?logo=socket.io)](https://socket.io/)
[![Jest](https://img.shields.io/badge/Jest-29.x-C21325?logo=jest)](https://jestjs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Real-time chat application with AI-powered sentiment analysis, room-based messaging, and beautiful modern UI.

## Features

- **Real-time Messaging** - Instant bidirectional communication via WebSocket
- **Sentiment Analysis** - Lexicon-based analysis with negation handling and intensifiers
- **Room-based Chat** - Multiple rooms with dynamic creation support
- **Typing Indicators** - See who's typing in real-time
- **Online User List** - Live list of users in each room
- **Message Persistence** - In-memory storage with JSON file backup
- **Chat History** - Scroll through past messages with pagination
- **Message Search** - Full-text search across room messages
- **Sentiment Statistics** - Per-room sentiment analytics
- **Responsive Design** - Works on desktop and mobile
- **Modern UI** - Clean, professional interface with sentiment color coding

## Screenshots

### Login Screen
```
+--------------------------------+
|            💬                  |
|      Chat Sentiment            |
| Real-time chat with sentiment  |
|--------------------------------|
| Choose a username              |
| [________________]             |
|--------------------------------|
| Select a room                  |
| (•) General Chat              |
| ( ) Technology                |
| ( ) Random                    |
| ( ) Support                   |
|--------------------------------|
|      [   Join Chat   ]         |
+--------------------------------+
```

### Chat Interface
```
+----------+-----------------------------+
| 💬 Chat  | #general         😊 🔍      |
|          |-----------------------------|
| Online   | alice joined the room       |
| 🟢 3     |                             |
|          | alice: Hello everyone! 😊   |
| alice    | bob: Hi Alice! Great app! 🤩|
| bob      |                             |
| charlie  | charlie: This is amazing! 🤩|
|          | bob is typing...            |
| Rooms    |                             |
| #general | [Type a message...] [Send]  |
+----------+-----------------------------+
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js 4.x |
| Real-time | Socket.IO 4.x |
| Frontend | Vanilla HTML5, CSS3, JavaScript |
| Testing | Jest + Supertest |
| Dev Tools | ESLint, Nodemon |

## Quick Start

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/chat-sentiment-app.git
cd chat-sentiment-app

# Install dependencies
npm install

# Start the server
npm start
```

### Development Mode

```bash
# Run with auto-restart on file changes
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

### Usage

1. Open your browser to `http://localhost:3000`
2. Enter a username (alphanumeric, hyphens, underscores only)
3. Select a room from the list
4. Click "Join Chat"
5. Start sending messages and watch the sentiment analysis in real-time!

## API Documentation

### REST Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/api/health` | Health check | `{ status, uptime, connections }` |
| GET | `/api/rooms` | List all rooms | `{ rooms, count }` |
| POST | `/api/rooms` | Create a room | `{ id, name, ... }` |
| GET | `/api/rooms/:id` | Room details | `{ id, name, users, stats }` |
| GET | `/api/rooms/:id/messages` | Get messages | `{ messages, total, hasMore }` |
| GET | `/api/rooms/:id/search` | Search messages | `{ messages, count }` |
| GET | `/api/rooms/:id/sentiment` | Sentiment stats | `{ totalMessages, sentimentCounts }` |
| GET | `/api/users/online` | Online users | `{ users, count }` |

### WebSocket Events

**Client to Server:**

| Event | Payload | Description |
|-------|---------|-------------|
| `user:join` | `{ username, roomId }` | Join a chat room |
| `message:send` | `{ text, roomId }` | Send a message |
| `typing:start` | `{ roomId }` | Start typing indicator |
| `typing:stop` | `{ roomId }` | Stop typing indicator |

**Server to Client:**

| Event | Payload | Description |
|-------|---------|-------------|
| `message:new` | `Message` | New message broadcast |
| `user:joined` | `{ username, users }` | User joined notification |
| `user:left` | `{ username, users }` | User left notification |
| `typing:update` | `{ typingUsers }` | Typing status update |
| `room:created` | `Room` | New room announcement |

## Architecture

The application follows a modular architecture with clear separation of concerns:

```
src/
├── server.js      # Express + Socket.IO server setup
├── sentiment.js   # Lexicon-based sentiment analysis engine
├── rooms.js       # Room CRUD and membership management
├── users.js       # User tracking and typing indicators
└── history.js     # Message persistence and retrieval
```

See [docs/architecture.md](docs/architecture.md) for detailed system design documentation.

### Sentiment Analysis Engine

The built-in sentiment analyzer uses a curated word lexicon with:

- **180+ scored words** from -5 (very negative) to +5 (very positive)
- **Negation handling** - "not good" correctly identifies as negative
- **Intensifier support** - "very good" scores higher than "good"
- **Double negation** - "not not bad" cancels out
- **5 sentiment levels** - very-positive, positive, neutral, negative, very-negative
- **Confidence scoring** - reliability metric for each analysis

## Project Structure

```
project_06_chat_sentiment/
├── src/
│   ├── server.js              # Main server entry point
│   ├── sentiment.js           # Sentiment analysis engine
│   ├── rooms.js               # Room management module
│   ├── users.js               # User tracking module
│   └── history.js             # Message persistence module
├── public/
│   ├── index.html             # Chat UI markup
│   ├── css/
│   │   └── style.css          # Application styles
│   └── js/
│       └── chat.js            # Client-side chat logic
├── tests/
│   ├── test_sentiment.js      # Sentiment engine tests
│   ├── test_rooms.js          # Room management tests
│   └── test_server.js         # API endpoint tests
├── docs/
│   └── architecture.md        # System architecture docs
├── data/                      # Message persistence (auto-created)
├── package.json               # Dependencies and scripts
├── README.md                  # This file
├── LICENSE                    # MIT License
├── .gitignore                 # Git ignore rules
```

## Running Tests

```bash
# Run all tests with coverage
npm test

# Example output:
# PASS  tests/test_sentiment.js
# PASS  tests/test_rooms.js
# PASS  tests/test_server.js
#
# Test Suites: 3 passed, 3 total
# Tests:       50+ passed
# Coverage:    80%+ statements
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | `*` | CORS origin for Socket.IO |

## Future Improvements

- **Database Integration** - MongoDB/PostgreSQL for production persistence
- **Redis** - Multi-server scaling with Redis adapter for Socket.IO
- **User Authentication** - JWT-based auth with registration/login
- **Private Messaging** - Direct messages between users
- **Message Reactions** - Emoji reactions to messages
- **File Sharing** - Image and file upload support
- **Push Notifications** - Browser notifications for mentions
- **Dark Mode** - Toggle between light and dark themes
- **Admin Dashboard** - Analytics and moderation tools
- **i18n** - Multi-language support

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure all tests pass and code follows ESLint rules.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Sentiment lexicon inspired by AFINN-165
- Socket.IO for reliable real-time communication
- Express.js team for the robust web framework

---

**Built with Node.js, Express, Socket.IO, and lots of caffeine.**
