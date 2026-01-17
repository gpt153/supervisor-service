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

## Phase 2: GitHub Webhooks

### Webhook Setup

1. **Configure webhook secret:**
```bash
# Generate a secure secret
openssl rand -hex 32

# Add to .env
GITHUB_WEBHOOK_SECRET=your_generated_secret
```

2. **Set up GitHub webhook:**

Go to your repository settings → Webhooks → Add webhook

- **Payload URL:** `https://your-domain.com/webhooks/github`
- **Content type:** `application/json`
- **Secret:** (use the same secret from step 1)
- **Events:** Select:
  - Issue comments
  - Issues
  - Pull requests

3. **Test webhook:**
```bash
# Create a test event
curl -X POST http://localhost:8080/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-GitHub-Delivery: test-123" \
  -H "X-Hub-Signature-256: sha256=<calculated-signature>" \
  -d '{"zen":"testing"}'
```

### Automated Verification

When SCAR posts a completion comment, the service automatically:

1. **Detects completion** - Monitors for keywords like "Implementation complete"
2. **Runs verification:**
   - Build validation (`npm run build`)
   - Test suite (`npm test`)
   - Mock/placeholder detection
3. **Posts results** - Comments back on the GitHub issue with verification report
4. **Adds labels** - Tags issue with verification status

### Verification Protocol

The verification runner checks:

- **Build Success** - Code compiles without errors
- **Tests Pass** - All tests execute successfully
- **No Mocks** - No placeholder code (TODO, MOCK, STUB, etc.)

Results are stored in `verification_results` table and posted as GitHub comments.

### Database Tables

**webhook_events** - Queue of incoming webhook events
```sql
- id: UUID
- event_type: GitHub event (issue_comment, issues, etc.)
- project_name: Identified project
- issue_number: Issue/PR number
- payload: Full webhook payload (JSONB)
- processed: Whether event has been handled
- created_at: Timestamp
```

**verification_results** - Historical verification data
```sql
- id: UUID
- project_name: Project identifier
- issue_number: Issue/PR number
- status: passed|failed|partial|error
- build_success: Boolean
- tests_passed: Boolean
- mocks_detected: Boolean
- details: Full results (JSONB)
- created_at: Timestamp
```

### Event Processing

Webhook events are processed asynchronously:

1. **Receive webhook** → Return 202 immediately
2. **Store in database** → webhook_events table
3. **Background processor** → Checks queue every 30 seconds
4. **Run verification** → If SCAR completion detected
5. **Post results** → GitHub comment with report
6. **Mark processed** → Update webhook_events

This ensures webhooks never timeout and verification can run for several minutes.


## Phase 4: Optional Adapters

The supervisor-service now includes multiple interface adapters for different use cases:

### Telegram Bot Adapter

Interact with your projects via Telegram bot.

**Features:**
- Project selection and switching
- Send commands to projects
- Trigger verifications
- Receive real-time updates
- Markdown-formatted responses

**Setup:**
1. Create bot via @BotFather
2. Set `TELEGRAM_ENABLED=true`
3. Set `TELEGRAM_BOT_TOKEN=your_token`
4. Start service and send `/start` to bot

**Commands:**
- `/start` - Welcome message
- `/help` - Show available commands
- `/status` - Show all projects
- `/current` - Show current project
- `/switch <project>` - Switch to project
- `/verify` - Verify current project
- Any text - Send command to current project

### Web Dashboard

Simple, clean web interface for monitoring and control.

**Features:**
- Overview of all projects
- Real-time status updates via SSE
- Manual verification triggers
- Activity log
- Project statistics

**Access:**
- URL: `http://localhost:8080/`
- No authentication required (add reverse proxy with auth for production)

**Configuration:**
```bash
WEB_DASHBOARD_ENABLED=true  # Default: true
```

### REST API

Full-featured REST API for custom integrations.

**Features:**
- List projects
- Get project status
- Send commands to projects
- List issues
- Trigger verifications
- Get verification results
- JWT and API key authentication
- Rate limiting
- OpenAPI documentation

**Authentication:**

JWT Token:
```bash
curl -H "Authorization: Bearer <jwt_token>" \
  http://localhost:8080/api/v1/projects
```

API Key:
```bash
curl -H "Authorization: ApiKey <api_key>" \
  http://localhost:8080/api/v1/projects
```

**Configuration:**
```bash
REST_API_ENABLED=true
JWT_SECRET=your_jwt_secret_here
API_KEYS=key1,key2,key3
```

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check (no auth) |
| GET | `/api/v1/projects` | List all projects |
| GET | `/api/v1/projects/:name/status` | Get project status |
| POST | `/api/v1/projects/:name/command` | Send command |
| GET | `/api/v1/projects/:name/issues` | List issues |
| POST | `/api/v1/projects/:name/verify/:issueNumber` | Verify issue |
| GET | `/api/v1/verification/:id` | Get verification result |

**Example Usage:**

```bash
# List projects
curl -H "Authorization: ApiKey your_key" \
  http://localhost:8080/api/v1/projects

# Get project status
curl -H "Authorization: ApiKey your_key" \
  http://localhost:8080/api/v1/projects/consilio/status

# Send command
curl -X POST \
  -H "Authorization: ApiKey your_key" \
  -H "Content-Type: application/json" \
  -d '{"command":"Show me the latest issues"}' \
  http://localhost:8080/api/v1/projects/consilio/command

# Trigger verification
curl -X POST \
  -H "Authorization: ApiKey your_key" \
  http://localhost:8080/api/v1/projects/consilio/verify/123
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions covering:

- Docker deployment (development and production)
- Systemd deployment (bare metal/VPS)
- Configuration management
- Security hardening
- Monitoring and logging
- Backup and recovery
- Performance tuning
- Troubleshooting

Quick start with Docker:

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Check health
curl http://localhost:8080/health
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Supervisor Service                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────┐  ┌─────────────┐  ┌──────────┐             │
│  │  Telegram  │  │     Web     │  │   REST   │             │
│  │   Adapter  │  │  Dashboard  │  │    API   │             │
│  └─────┬──────┘  └──────┬──────┘  └────┬─────┘             │
│        │                 │              │                    │
│        └─────────────────┴──────────────┘                    │
│                          │                                   │
│                    ┌─────▼─────┐                            │
│                    │           │                            │
│                    │Orchestrator│                            │
│                    │           │                            │
│                    └─────┬─────┘                            │
│                          │                                   │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│   ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐          │
│   │ Project   │   │ Project   │   │ Project   │          │
│   │ Manager 1 │   │ Manager 2 │   │ Manager 3 │          │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘          │
│         │               │               │                  │
│         └───────────────┴───────────────┘                  │
│                         │                                   │
│                   ┌─────▼──────┐                           │
│                   │            │                           │
│                   │Claude Agent│                           │
│                   │    SDK     │                           │
│                   │            │                           │
│                   └────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Testing

```bash
# Run tests (when implemented)
npm test

# Build
npm run build

# Start development
npm run dev

# MCP server
npm run mcp
```

## License

ISC
