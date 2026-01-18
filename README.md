# Supervisor Service

Meta-supervisor service for managing multiple AI-developed projects with secrets, ports, tasks, and cloud resources.

## Features

- **Secrets Management**: AES-256-GCM encrypted storage for API keys, tokens, and passwords
- **Port Allocation**: Automated port range management for project services
- **Task Timing**: Execution tracking and estimation system
- **Cloud Integration**: Stubs for Cloudflare DNS and GCloud VM management (ready to implement)
- **MCP Server**: Model Context Protocol server for Claude integration

## Installation

```bash
npm install
npm run build
```

## Database Setup

The service uses PostgreSQL for persistent storage.

### Prerequisites

- PostgreSQL 14+ installed
- `pgvector` extension available
- User with database creation privileges

### Initial Setup

Database and schema are already configured. Connection uses Unix socket with trust authentication for `supervisor_user`.

Verify connection:
```bash
npm start
```

## Configuration

All configuration via environment variables in `.env`:

```env
# Encryption key for secrets (32 bytes hex)
ENCRYPTION_KEY=ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f

# Database connection (Unix socket)
DB_HOST=/var/run/postgresql
DB_PORT=5434
DB_NAME=supervisor
DB_USER=supervisor_user
DB_PASSWORD=
```

## Usage

### Direct API

```typescript
import { SecretsManager } from './src/secrets/SecretsManager.js';
import { PortManager } from './src/ports/PortManager.js';
import { TaskTimer } from './src/timing/TaskTimer.js';

// Secrets
const secretsManager = new SecretsManager(process.env.ENCRYPTION_KEY);
await secretsManager.store('meta/anthropic/api_key', 'sk-ant-...');
const key = await secretsManager.retrieve('meta/anthropic/api_key');

// Ports
const portManager = new PortManager();
const allocation = await portManager.allocatePort('consilio', 'penpot');
console.log(`Allocated port: ${allocation.port}`);

// Tasks
const taskTimer = new TaskTimer();
await taskTimer.startTask('task-123', 'epic_creation', 'Create epic for auth');
await taskTimer.completeTask('task-123');
```

### MCP Server

Start MCP server on stdio:

```bash
npm run mcp
```

Available MCP tools:

**Secrets:**
- `mcp__meta__store_secret` - Store encrypted secret
- `mcp__meta__retrieve_secret` - Retrieve secret by key path
- `mcp__meta__list_secrets` - List all secrets (metadata only)

**Ports:**
- `mcp__meta__allocate_port` - Allocate next available port
- `mcp__meta__list_ports` - List port allocations
- `mcp__meta__get_port_utilization` - Get project port usage
- `mcp__meta__release_port` - Release a port

**Tasks:**
- `mcp__meta__start_task` - Start timing a task
- `mcp__meta__complete_task` - Mark task complete
- `mcp__meta__get_task_stats` - Get execution statistics

## Architecture

```
supervisor-service/
├── src/
│   ├── index.ts              # Main entry point
│   ├── secrets/
│   │   └── SecretsManager.ts # AES-256-GCM encryption
│   ├── ports/
│   │   └── PortManager.ts    # Port allocation (3000-65535)
│   ├── timing/
│   │   └── TaskTimer.ts      # Execution tracking
│   ├── cloudflare/
│   │   └── CloudflareManager.ts  # DNS/tunnel stubs
│   ├── gcloud/
│   │   └── GCloudManager.ts  # VM management stubs
│   ├── mcp/
│   │   └── server.ts         # MCP server implementation
│   └── db/
│       ├── pool.ts           # Connection pool
│       ├── schema.sql        # Database schema
│       └── setup.ts          # Setup script
└── dist/                     # Compiled JavaScript
```

## Database Schema

### Core Tables

- **secrets**: Encrypted key-value storage with metadata
- **project_port_ranges**: Port ranges per project (100 ports each)
- **port_allocations**: Active port assignments
- **task_executions**: Task timing and estimation data

### Additional Tables (Ready for Implementation)

- **knowledge_chunks**: RAG embeddings for learnings
- **cloudflare_dns_records**: DNS record tracking
- **cloudflare_tunnel_routes**: Cloudflare tunnel mappings
- **gcloud_vms**: VM instance tracking
- **gcloud_health_metrics**: VM health data

## Port Allocation System

Each project gets 100 ports:
- Project 0 (meta): 3000-3099
- Project 1: 3100-3199
- Project 2: 3200-3299
- ...and so on

Shared services: 9000-9099

## Security

- Secrets encrypted with AES-256-GCM
- Unique IV per secret
- Authentication tags for integrity
- Encryption key stored in environment (never in database)

## Development

```bash
# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests (when implemented)
npm test
```

## What's Done

✅ SecretsManager with AES-256-GCM encryption
✅ PortManager with automatic allocation
✅ TaskTimer for execution tracking
✅ CloudflareManager stub (ready to implement)
✅ GCloudManager stub (ready to implement)
✅ MCP server with 9 tools
✅ Database schema and connection pooling
✅ Health checks and statistics

## What's Next (Future Enhancement)

- Implement actual Cloudflare API integration
- Implement GCloud Compute Engine integration
- Add HTTP/REST API server
- Add webhook handlers
- Implement RAG knowledge search
- Add Telegram/Slack adapters
- Add authentication and multi-user support

## License

MIT
