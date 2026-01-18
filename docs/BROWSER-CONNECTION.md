# Browser Connection Guide - Claude.ai Projects

**Connect Claude.ai browser projects to supervisor-service MCP server for secrets, ports, and task tracking.**

---

## Overview

This guide shows how to connect Claude.ai browser projects to supervisor-service via SSE (Server-Sent Events).

**Architecture:**
- SSE MCP server runs on port 8082
- Cloudflare tunnel exposes: `https://supermcp.153.se`
- Project-scoped endpoints provide isolation
- Works alongside GitHub MCP for repo access

**What you get:**
- Encrypted secret storage (API keys, tokens)
- Port allocation management
- Task timing and statistics
- Multi-project isolation

---

## Quick Start

### 1. Start SSE Server

```bash
# Build TypeScript
cd /home/samuel/supervisor/supervisor-service
npm run build

# Start SSE server
npm run mcp:sse

# Verify health
curl http://localhost:8082/health
```

Server logs:
```
MCP SSE Server running on port 8082
SSE endpoint: http://localhost:8082/sse
Public URL: https://supermcp.153.se/sse

Connect from Claude.ai Projects with:
  Meta project: https://supermcp.153.se/sse?project=meta
  Consilio: https://supermcp.153.se/sse?project=consilio
  Health-Agent: https://supermcp.153.se/sse?project=health-agent
  Odin: https://supermcp.153.se/sse?project=odin
```

### 2. Configure Cloudflare Tunnel

Add to `/etc/cloudflared/config.yml`:

```yaml
ingress:
  # Existing routes...

  # Supervisor MCP SSE server
  - hostname: supermcp.153.se
    service: http://localhost:8082

  # Fallback
  - service: http_status:404
```

Restart Cloudflare tunnel:
```bash
sudo systemctl restart cloudflared
```

Verify:
```bash
curl https://supermcp.153.se/health
```

### 3. Connect from Claude.ai

**Go to:** https://claude.ai/projects

**For each project:**

1. Click project name → Settings → MCP Servers
2. Add supervisor-service MCP
3. Add GitHub MCP (if needed)

---

## Project-Specific Configurations

### Meta Project (Full Access)

**Use case:** Root supervisor managing all projects

**MCP Configuration:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "transport": "sse",
      "url": "https://supermcp.153.se/sse?project=meta"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**What meta can do:**
- Access ALL secrets (meta/*, project/*/*)
- Allocate ports for ANY project
- View ALL task stats
- Full administrative access

**When to use:**
- Cross-project operations
- Managing shared secrets (Anthropic API key, etc.)
- Port allocation overview
- System-wide task analytics

---

### Consilio Project (Scoped Access)

**Use case:** Consilio-specific development

**MCP Configuration:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "transport": "sse",
      "url": "https://supermcp.153.se/sse?project=consilio"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**What Consilio can do:**
- Access ONLY secrets under `project/consilio/*`
- Allocate ports ONLY for Consilio (auto-scoped)
- View ONLY Consilio task stats
- Isolated from other projects

**Example secrets:**
- `project/consilio/stripe_key`
- `project/consilio/firebase_config`
- `project/consilio/sendgrid_api_key`

**Example usage in Claude.ai:**
```
User: "Store our Stripe API key"
Claude: → mcp__meta__store_secret(
  keyPath="project/consilio/stripe_key",
  value="sk_test_...",
  secretType="api_key",
  provider="stripe"
)

User: "Allocate a port for the API server"
Claude: → mcp__meta__allocate_port(
  projectName="consilio",  // auto-scoped
  serviceName="api-server",
  cloudflareHostname="consilio-api.153.se"
)
```

---

### Health-Agent Project (Scoped Access)

**MCP Configuration:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "transport": "sse",
      "url": "https://supermcp.153.se/sse?project=health-agent"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**What Health-Agent can do:**
- Access ONLY secrets under `project/health-agent/*`
- Allocate ports ONLY for Health-Agent
- View ONLY Health-Agent task stats

**Example secrets:**
- `project/health-agent/telegram_bot_token`
- `project/health-agent/openai_api_key`
- `project/health-agent/health_data_encryption_key`

---

### Odin Project (Scoped Access)

**MCP Configuration:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "transport": "sse",
      "url": "https://supermcp.153.se/sse?project=odin"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**What Odin can do:**
- Access ONLY secrets under `project/odin/*`
- Allocate ports ONLY for Odin
- View ONLY Odin task stats

**Example secrets:**
- `project/odin/aws_access_key`
- `project/odin/postgres_password`
- `project/odin/redis_url`

---

## Security Model

### Project Isolation

**Enforced at MCP layer via query parameter:**

```
?project=consilio
  ↓
  Filter secrets: ONLY project/consilio/*
  Filter ports: ONLY Consilio allocations
  Filter tasks: ONLY Consilio tasks
```

**Attempts to bypass fail:**

```typescript
// ❌ BLOCKED - Consilio trying to access Odin secrets
mcp__meta__retrieve_secret("project/odin/aws_key")
→ Error: "Access denied: Project consilio can only access secrets under project/consilio/"

// ❌ BLOCKED - Consilio trying to allocate port for Odin
mcp__meta__allocate_port("odin", "service")
→ Error: "Access denied: Project consilio can only allocate ports for itself"
```

### Meta Project Privileges

**Only meta project can:**
- Access secrets across ALL projects
- View port allocations for ALL projects
- Create port ranges for NEW projects
- View task stats across ALL projects

**Use meta project sparingly:**
- System administration
- Cross-project secret sharing
- Port utilization analysis
- Performance benchmarking

---

## Available MCP Tools

### Secrets Management

**1. Store Secret**
```typescript
mcp__meta__store_secret(
  keyPath: string,        // "project/{project}/stripe_key"
  value: string,          // "sk_test_..."
  description?: string,   // "Stripe test API key"
  secretType?: string,    // "api_key"
  provider?: string       // "stripe"
)
```

**2. Retrieve Secret**
```typescript
mcp__meta__retrieve_secret(
  keyPath: string         // "project/{project}/stripe_key"
)
→ Returns decrypted value
```

**3. List Secrets**
```typescript
mcp__meta__list_secrets(
  provider?: string,      // Filter by provider
  secretType?: string     // Filter by type
)
→ Returns metadata only (no values)
```

---

### Port Management

**1. Allocate Port**
```typescript
mcp__meta__allocate_port(
  projectName: string,           // "consilio" (auto-scoped)
  serviceName: string,           // "api-server"
  description?: string,          // "Main API backend"
  cloudflareHostname?: string    // "consilio-api.153.se"
)
→ Returns: { port: 3012, serviceName: "api-server", ... }
```

**2. List Ports**
```typescript
mcp__meta__list_ports(
  projectName?: string,          // Auto-scoped for non-meta
  includeReleased?: boolean      // Default: false
)
→ Returns all allocations for project
```

**3. Get Port Utilization**
```typescript
mcp__meta__get_port_utilization(
  projectName: string            // Auto-scoped for non-meta
)
→ Returns: { total: 100, allocated: 15, available: 85, utilizationPercent: 15 }
```

**4. Release Port**
```typescript
mcp__meta__release_port(
  port: number                   // 3012
)
→ Marks port as released
```

---

### Task Tracking

**1. Start Task**
```typescript
mcp__meta__start_task(
  taskId: string,                // "epic-001-creation"
  taskType: string,              // "epic_creation"
  taskDescription: string,       // "Create epic for authentication"
  estimatedSeconds?: number,     // 300
  projectName?: string,          // Auto-scoped for non-meta
  complexity?: "simple"|"moderate"|"complex"
)
→ Returns: { taskId, startedAt }
```

**2. Complete Task**
```typescript
mcp__meta__complete_task(
  taskId: string,                // "epic-001-creation"
  filesChanged?: number,         // 3
  linesChanged?: number          // 250
)
→ Returns: { taskId, durationSeconds, status }
```

**3. Get Task Stats**
```typescript
mcp__meta__get_task_stats(
  taskType?: string,             // "epic_creation"
  projectName?: string           // Auto-scoped for non-meta
)
→ Returns: { taskType, avgDuration, stddevDuration, successRate, ... }
```

---

## Usage Examples

### Example 1: Consilio Stores Stripe Key

**In Claude.ai Projects (Consilio tab):**

```
User: "Store our Stripe test API key: sk_test_xyz123"

Claude uses MCP:
mcp__meta__store_secret(
  keyPath="project/consilio/stripe_key",
  value="sk_test_xyz123",
  description="Stripe test API key",
  secretType="api_key",
  provider="stripe"
)

Response:
{
  "success": true,
  "keyPath": "project/consilio/stripe_key",
  "createdAt": "2026-01-18T12:00:00Z",
  "message": "Secret stored successfully"
}
```

**Later, retrieve it:**
```
User: "What's our Stripe API key?"

Claude uses MCP:
mcp__meta__retrieve_secret(
  keyPath="project/consilio/stripe_key"
)

Response:
{
  "success": true,
  "keyPath": "project/consilio/stripe_key",
  "value": "sk_test_xyz123"
}
```

---

### Example 2: Health-Agent Allocates Port

**In Claude.ai Projects (Health-Agent tab):**

```
User: "Allocate a port for the Telegram bot webhook server"

Claude uses MCP:
mcp__meta__allocate_port(
  projectName="health-agent",  // Auto-scoped
  serviceName="telegram-webhook",
  description="Telegram bot webhook receiver",
  cloudflareHostname="health-bot.153.se"
)

Response:
{
  "success": true,
  "port": 3105,
  "serviceName": "telegram-webhook",
  "projectName": "health-agent",
  "allocatedAt": "2026-01-18T12:05:00Z"
}
```

**Check utilization:**
```
User: "How many ports are we using?"

Claude uses MCP:
mcp__meta__get_port_utilization(
  projectName="health-agent"  // Auto-scoped
)

Response:
{
  "success": true,
  "projectName": "health-agent",
  "utilization": {
    "total": 100,
    "allocated": 5,
    "available": 95,
    "utilizationPercent": 5
  }
}
```

---

### Example 3: Meta Project Cross-Project Audit

**In Claude.ai Projects (Meta tab):**

```
User: "Show me all Stripe API keys across all projects"

Claude uses MCP:
mcp__meta__list_secrets(
  provider="stripe"
)

Response:
{
  "success": true,
  "count": 3,
  "secrets": [
    {
      "keyPath": "project/consilio/stripe_key",
      "description": "Stripe test API key",
      "secretType": "api_key",
      "provider": "stripe",
      "createdAt": "2026-01-18T12:00:00Z"
    },
    {
      "keyPath": "project/odin/stripe_key",
      "description": "Stripe production API key",
      "secretType": "api_key",
      "provider": "stripe",
      "createdAt": "2026-01-17T10:30:00Z"
    },
    {
      "keyPath": "meta/stripe_connect_key",
      "description": "Stripe Connect master key",
      "secretType": "api_key",
      "provider": "stripe",
      "createdAt": "2026-01-16T08:00:00Z"
    }
  ]
}
```

**Check port utilization across all projects:**
```
User: "Show port utilization for all projects"

Claude uses MCP (multiple calls):
mcp__meta__get_port_utilization("consilio")
mcp__meta__get_port_utilization("health-agent")
mcp__meta__get_port_utilization("odin")

Response (aggregated):
- Consilio: 15/100 (15%)
- Health-Agent: 5/100 (5%)
- Odin: 22/100 (22%)
Total: 42/300 (14%)
```

---

## Dual MCP Setup

**Each Claude.ai project should have TWO MCP servers:**

### 1. Supervisor-Service MCP (This Server)

**Purpose:** Shared infrastructure
- Secrets (API keys, tokens)
- Port allocations
- Task tracking

**Configuration:** Project-scoped URL
```json
{
  "supervisor-service": {
    "transport": "sse",
    "url": "https://supermcp.153.se/sse?project=consilio"
  }
}
```

### 2. GitHub MCP (Official)

**Purpose:** Repo-specific operations
- Create issues
- Read/write code
- Manage PRs

**Configuration:** Repo-specific env
```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN",
      "GITHUB_OWNER": "gpt153",
      "GITHUB_REPO": "consilio"
    }
  }
}
```

**Why both?**
- Supervisor-service: Infrastructure (secrets, ports, tasks)
- GitHub: Code operations (issues, PRs, files)
- Clean separation of concerns

---

## Troubleshooting

### Connection Issues

**Problem:** SSE connection fails

**Solutions:**
```bash
# Check server running
curl http://localhost:8082/health

# Check Cloudflare tunnel
curl https://supermcp.153.se/health

# View server logs
npm run mcp:sse

# Check browser console (Claude.ai)
F12 → Console → Look for SSE errors
```

---

### Permission Errors

**Problem:** "Access denied: Project consilio can only access..."

**Cause:** Project trying to access another project's resources

**Solution:**
- Use meta project for cross-project operations
- Or store secret under correct project path: `project/consilio/*`

---

### Port Exhaustion

**Problem:** "No more ports available"

**Cause:** Project used all 100 ports in range

**Solution:**
```typescript
// List current allocations
mcp__meta__list_ports(projectName="consilio", includeReleased=false)

// Release unused ports
mcp__meta__release_port(port=3012)

// Or contact admin to expand range (meta project)
```

---

## Best Practices

### 1. Secret Naming Convention

```
project/{project-name}/{provider}_{type}_{env}

Examples:
- project/consilio/stripe_key_test
- project/consilio/stripe_key_prod
- project/health-agent/telegram_bot_token
- meta/anthropic_api_key_prod
```

### 2. Port Documentation

**Always include:**
- Descriptive service name
- Cloudflare hostname
- Description of service

```typescript
mcp__meta__allocate_port(
  projectName="consilio",
  serviceName="api-server-prod",
  description="Production API backend (Express + PostgreSQL)",
  cloudflareHostname="api.consilio.153.se"
)
```

### 3. Task Tracking

**Track ALL significant operations:**
```typescript
// Start before long operation
mcp__meta__start_task(
  taskId="consilio-epic-003-implementation",
  taskType="epic_implementation",
  taskDescription="Implement Epic 003: Payment Processing",
  estimatedSeconds=3600,
  complexity="complex"
)

// Complete when done
mcp__meta__complete_task(
  taskId="consilio-epic-003-implementation",
  filesChanged=15,
  linesChanged=850
)
```

**Benefits:**
- Historical performance data
- Better time estimates
- Project velocity metrics

---

## Production Deployment

### Systemd Service

**Create:** `/etc/systemd/system/supervisor-mcp-sse.service`

```ini
[Unit]
Description=Supervisor MCP SSE Server
After=network.target postgresql.service

[Service]
Type=simple
User=samuel
WorkingDirectory=/home/samuel/supervisor/supervisor-service
Environment="ENCRYPTION_KEY=your-64-hex-character-key"
Environment="DATABASE_URL=postgresql://user:pass@localhost/supervisor"
ExecStart=/usr/bin/npm run mcp:sse
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable supervisor-mcp-sse
sudo systemctl start supervisor-mcp-sse
sudo systemctl status supervisor-mcp-sse
```

---

## Summary

**What you set up:**
1. SSE MCP server on port 8082
2. Cloudflare tunnel to `supermcp.153.se`
3. Project-scoped endpoints for isolation
4. Dual MCP config (supervisor-service + GitHub)

**What each project gets:**
- Encrypted secret storage (project-scoped)
- Port allocation (100 ports per project)
- Task tracking and analytics
- Multi-project isolation

**Next steps:**
1. Start SSE server: `npm run mcp:sse`
2. Configure Cloudflare tunnel
3. Add MCP configs to Claude.ai projects
4. Test with health endpoint
5. Start using MCP tools!

**For help:**
- Server logs: `npm run mcp:sse` (stderr)
- Health check: `curl https://supermcp.153.se/health`
- Test connection: Open Claude.ai → Project Settings → MCP Servers
