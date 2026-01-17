# Supervisor Service

Multi-project supervisor service that manages Claude Code instances for multiple projects with persistent session management, GitHub webhook integration, and MCP server capabilities.

## Phase 1: Core Service (IMPLEMENTED)

Phase 1 provides the foundational service with:
- **ProjectManager**: Manages individual project Claude Code instances using @anthropic-ai/claude-agent-sdk
- **Session Persistence**: PostgreSQL storage for session recovery across restarts
- **Orchestrator**: Coordinates multiple ProjectManager instances
- **MCP Configuration**: GitHub and Archon MCP server setup
- **HTTP Server**: Express server with health check endpoint
- **Database Schema**: Tables for sessions, webhook events, and verification results

## Features

### Completed (Phase 1)
- ✅ Project setup with TypeScript strict mode
- ✅ Database schema (sessions, webhooks, verifications)
- ✅ ProjectManager with Claude Agent SDK integration
- ✅ Session persistence and resume functionality
- ✅ MCP server configuration (GitHub, Archon)
- ✅ Orchestrator for multi-project coordination
- ✅ HTTP server with health check endpoint
- ✅ Graceful shutdown handling
- ✅ Error handling and logging

### Planned (Future Phases)
- Phase 2: GitHub webhook integration
- Phase 3: MCP server for Claude.ai Projects
- Phase 4: Optional adapters (Telegram, Web UI)

## Architecture

```
supervisor-service/
├── src/
│   ├── index.ts                  # Entry point and HTTP server
│   ├── config.ts                 # Environment configuration
│   ├── managers/
│   │   ├── ProjectManager.ts     # Claude Code instance manager
│   │   └── buildMcpServers.ts    # MCP server configuration
│   ├── orchestrator/
│   │   └── Orchestrator.ts       # Multi-project coordinator
│   └── storage/
│       └── SessionStore.ts       # PostgreSQL session storage
├── migrations/                   # Database migrations
│   ├── 001_create_sessions.sql
│   ├── 002_create_webhooks.sql
│   └── 003_create_verifications.sql
└── scripts/
    └── migrate.sh               # Migration runner
```

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Claude API key
- GitHub token (for MCP)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Run database migrations:
```bash
npm run db:migrate
```

4. Build TypeScript:
```bash
npm run build
```

5. Start service:
```bash
npm start
```

### Development Mode

Run without building:
```bash
npm run dev
```

## Configuration

### Environment Variables

See `.env.example` for all configuration options:

**Required:**
- `ANTHROPIC_API_KEY`: Claude API key
- `DATABASE_URL`: PostgreSQL connection string
- `DATABASE_PASSWORD`: Database password
- `GITHUB_TOKEN`: GitHub personal access token

**Optional:**
- `PORT`: HTTP server port (default: 8080)
- `LOG_LEVEL`: Logging level (default: info)
- `MCP_GITHUB_ENABLED`: Enable GitHub MCP (default: true)
- `MCP_ARCHON_ENABLED`: Enable Archon MCP (default: false)

## Database Schema

### supervisor_sessions
Stores Claude Code session information for each project.

```sql
- id: UUID (primary key)
- project_name: VARCHAR(255) UNIQUE
- claude_session_id: VARCHAR(255) (nullable)
- created_at: TIMESTAMP
- last_active: TIMESTAMP
- metadata: JSONB
```

### webhook_events
Queue for async processing of GitHub webhook events.

```sql
- id: UUID (primary key)
- event_type: VARCHAR(100)
- project_name: VARCHAR(255)
- issue_number: INTEGER
- payload: JSONB
- processed: BOOLEAN
- processed_at: TIMESTAMP
- created_at: TIMESTAMP
```

### verification_results
Historical record of SCAR implementation verifications.

```sql
- id: UUID (primary key)
- project_name: VARCHAR(255)
- issue_number: INTEGER
- status: VARCHAR(50) (passed, failed, partial, error)
- build_success: BOOLEAN
- tests_passed: BOOLEAN
- mocks_detected: BOOLEAN
- details: JSONB
- created_at: TIMESTAMP
```

## API Endpoints

### Health Check
```
GET /health
```

Returns service status, database connectivity, and active projects.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T12:00:00.000Z",
  "service": "supervisor-service",
  "version": "1.0.0",
  "database": "connected",
  "activeProjects": 3,
  "projects": ["consilio", "openhorizon", "health-agent"]
}
```

### Root
```
GET /
```

Returns service information and available endpoints.

## Usage

### ProjectManager

Manages a single project's Claude Code instance:

```typescript
import { ProjectManager } from './managers/ProjectManager';

const manager = new ProjectManager({
  projectName: 'consilio',
  sessionId: 'abc123', // Optional: resume existing session
});

// Send command
const response = await manager.sendCommand({
  command: 'Check progress on issue #123',
  onStreamChunk: (chunk) => console.log(chunk),
  onComplete: (response) => console.log('Complete:', response),
  onError: (error) => console.error('Error:', error),
});
```

### Orchestrator

Coordinates multiple projects:

```typescript
import { Orchestrator } from './orchestrator/Orchestrator';
import { SessionStore } from './storage/SessionStore';

const sessionStore = new SessionStore();
await sessionStore.initialize();

const orchestrator = new Orchestrator({ sessionStore });
await orchestrator.initialize();

// Send command to specific project
const response = await orchestrator.sendCommand(
  'consilio',
  'Show status of all epics',
  {
    onStreamChunk: (chunk) => console.log(chunk),
  }
);
```

## Session Persistence

Sessions are automatically saved to the database after each command. On service restart:

1. SessionStore loads all existing sessions
2. Orchestrator creates ProjectManager instances with saved session IDs
3. Claude Agent SDK resumes sessions when next command is sent
4. No context is lost

## Error Handling

The service includes comprehensive error handling:
- Database connection failures
- Claude API errors
- Invalid project names
- Session resume failures
- Graceful shutdown on SIGTERM/SIGINT

## Logging

All requests and operations are logged to console:
```
GET /health 200 - 15ms
Starting Supervisor Service...
Connecting to database...
Database connected successfully
Initializing orchestrator...
Orchestrator initialized with 3 projects
```

## Testing

```bash
# Run tests (Phase 2+)
npm test

# Build and verify compilation
npm run build
```

## Deployment

The service is designed to run as a systemd daemon on a Linux VM.

### Systemd Service File (Example)

```ini
[Unit]
Description=Supervisor Service
After=network.target postgresql.service

[Service]
Type=simple
User=samuel
WorkingDirectory=/home/samuel/.archon/workspaces/supervisor-service
Environment=NODE_ENV=production
EnvironmentFile=/home/samuel/.archon/workspaces/supervisor-service/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Next Steps (Future Phases)

### Phase 2: GitHub Webhooks
- Webhook endpoint receiver
- Event parsing and project identification
- Auto-trigger verification on SCAR completion
- Post results back to GitHub

### Phase 3: MCP Server
- Implement MCP server for Claude.ai Projects
- Planning file operations (read/write/list)
- Git operations (status, commit, push)
- GitHub API integration
- SCAR monitoring tools
- Verification tools

### Phase 4: Optional Adapters
- Telegram bot adapter
- Simple web dashboard
- REST API for custom clients

## License

ISC

## Contributing

This is a personal project for managing multiple supervisor instances.
