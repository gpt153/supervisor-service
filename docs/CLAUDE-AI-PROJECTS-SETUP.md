# Claude.ai Projects Setup Guide

**Connect your supervisor-service to Claude.ai browser for Opus-powered planning!**

---

## Architecture

```
Claude.ai Browser (Opus for planning!)
  ├── Project: "Consilio Planning"
  │   ├── MCP Server 1: supervisor-service (project: consilio)
  │   └── MCP Server 2: GitHub MCP (repo: gpt153/consilio)
  │
  ├── Project: "OpenHorizon Planning"
  │   ├── MCP Server 1: supervisor-service (project: openhorizon)
  │   └── MCP Server 2: GitHub MCP (repo: gpt153/openhorizon.cc)
  │
  └── Project: "Meta Supervisor"
      ├── MCP Server 1: supervisor-service (full access)
      └── MCP Server 2: GitHub MCP (repo: gpt153/supervisor)
```

**Benefits:**
- ✅ Use Opus in browser (not available in CLI)
- ✅ Access from any device (laptop, tablet, phone)
- ✅ Project isolation (Consilio can't see OpenHorizon secrets)
- ✅ Dual MCP (supervisor-service + GitHub integration)
- ✅ Natural language planning

---

## Prerequisites

1. **supervisor-service running on VM**
   ```bash
   cd /home/samuel/supervisor/supervisor-service
   npm run build
   ```

2. **Database configured**
   - PostgreSQL with supervisor database
   - ENCRYPTION_KEY in .env

3. **GitHub token** (for GitHub MCP)
   - Classic token with repo, issues, pr permissions

---

## Setup Steps

### Step 1: Configure Meta Supervisor Project

**In Claude.ai:**
1. Go to Projects → Create New Project → "Meta Supervisor"
2. Settings → MCP Servers → Add Server

**Configuration:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "command": "ssh",
      "args": [
        "samuel@your-vm-ip",
        "cd /home/samuel/supervisor/supervisor-service && node dist/mcp/server.js"
      ],
      "env": {
        "PROJECT_NAME": "meta",
        "DB_HOST": "/var/run/postgresql",
        "DB_PORT": "5434",
        "DB_NAME": "supervisor",
        "DB_USER": "supervisor_user",
        "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "supervisor"
      }
    }
  }
}
```

**PROJECT_NAME="meta"** = Full access to all secrets, all ports, all projects

---

### Step 2: Configure Consilio Project

**In Claude.ai:**
1. Create New Project → "Consilio Planning"
2. Settings → MCP Servers → Add Server

**Configuration:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "command": "ssh",
      "args": [
        "samuel@your-vm-ip",
        "cd /home/samuel/supervisor/supervisor-service && node dist/mcp/server.js"
      ],
      "env": {
        "PROJECT_NAME": "consilio",
        "DB_HOST": "/var/run/postgresql",
        "DB_PORT": "5434",
        "DB_NAME": "supervisor",
        "DB_USER": "supervisor_user",
        "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "consilio"
      }
    }
  }
}
```

**PROJECT_NAME="consilio"** = Only sees:
- Secrets: `project/consilio/*`
- Ports: Consilio's range (auto-assigned during project creation)
- Tasks: Consilio's task history

---

### Step 3: Configure OpenHorizon Project

**Same pattern, different project:**
```json
{
  "mcpServers": {
    "supervisor-service": {
      "command": "ssh",
      "args": [
        "samuel@your-vm-ip",
        "cd /home/samuel/supervisor/supervisor-service && node dist/mcp/server.js"
      ],
      "env": {
        "PROJECT_NAME": "openhorizon",
        "DB_HOST": "/var/run/postgresql",
        "DB_PORT": "5434",
        "DB_NAME": "supervisor",
        "DB_USER": "supervisor_user",
        "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "openhorizon.cc"
      }
    }
  }
}
```

---

## Project Scoping Logic

**How PROJECT_NAME env var controls access:**

### Meta Project (`PROJECT_NAME="meta"`)
```typescript
// Full access - no filtering
secrets.list()  → All secrets from all projects
ports.list()    → All ports from all projects
tasks.stats()   → All task stats across all projects
```

### Consilio Project (`PROJECT_NAME="consilio"`)
```typescript
// Project-scoped filtering
secrets.list()  → Only secrets with keyPath: "project/consilio/*"
ports.list()    → Only Consilio's port range (e.g., 3100-3199)
tasks.stats()   → Only Consilio's task history
```

### OpenHorizon Project (`PROJECT_NAME="openhorizon"`)
```typescript
// Project-scoped filtering
secrets.list()  → Only "project/openhorizon/*"
ports.list()    → Only OpenHorizon's port range (e.g., 3200-3299)
tasks.stats()   → Only OpenHorizon's tasks
```

---

## Available Tools per Project

### All Projects Get:
- ✅ **Secrets tools**: store_secret, retrieve_secret, list_secrets
- ✅ **Ports tools**: allocate_port, list_ports, get_utilization, release_port
- ✅ **Task tools**: start_task, complete_task, get_stats
- ✅ **GitHub tools**: (via separate GitHub MCP server)
  - create_issue, list_issues, read_issue, comment_issue, etc.

### Meta Project Also Gets:
- ✅ Cross-project visibility
- ✅ Create new projects (allocate port ranges)
- ✅ Manage shared services
- ✅ Global statistics

---

## Usage Examples

### In Consilio Project (Claude.ai browser):

```
You: "Store my Stripe API key"
Claude: [Uses mcp__meta__store_secret]
→ Stores to: project/consilio/stripe_api_key

You: "What ports am I using?"
Claude: [Uses mcp__meta__list_ports]
→ Shows only: 3100-3199 range

You: "Create GitHub issue for user authentication"
Claude: [Uses GitHub MCP create_issue]
→ Creates in: gpt153/consilio repo
```

### In Meta Project (Claude.ai browser):

```
You: "Show all secrets across all projects"
Claude: [Uses mcp__meta__list_secrets]
→ Shows: meta/*, project/consilio/*, project/openhorizon/*

You: "Which ports are allocated?"
Claude: [Uses mcp__meta__list_ports]
→ Shows: All projects' ports

You: "Create port range for new project hitster-game"
Claude: [Uses mcp__meta__allocate_port_range]
→ Creates: 3300-3399 for hitster-game
```

---

## SSH Connection Setup

**If using `ssh` command in MCP config:**

1. **Set up SSH key authentication** (no password prompts):
   ```bash
   # On your local machine (where browser runs)
   ssh-keygen -t ed25519 -C "claude-mcp"
   ssh-copy-id samuel@your-vm-ip

   # Test passwordless login
   ssh samuel@your-vm-ip "echo success"
   ```

2. **Alternative: Use control socket for faster connections:**
   ```bash
   # Add to ~/.ssh/config on local machine
   Host supervisor-vm
     HostName your-vm-ip
     User samuel
     ControlMaster auto
     ControlPath ~/.ssh/control-%r@%h:%p
     ControlPersist 10m
   ```

   Then use `"supervisor-vm"` instead of IP in MCP config.

---

## Alternative: Direct Node Connection (No SSH)

**If Claude.ai runs on same machine as supervisor-service:**

```json
{
  "mcpServers": {
    "supervisor-service": {
      "command": "node",
      "args": [
        "/home/samuel/supervisor/supervisor-service/dist/mcp/server.js"
      ],
      "env": {
        "PROJECT_NAME": "consilio",
        "DB_HOST": "/var/run/postgresql",
        "DB_PORT": "5434",
        "DB_NAME": "supervisor",
        "DB_USER": "supervisor_user",
        "ENCRYPTION_KEY": "ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f"
      }
    }
  }
}
```

**Note:** Most users access Claude.ai from laptop/phone, so SSH method is more common.

---

## Testing the Connection

### 1. Check MCP server works locally:
```bash
cd /home/samuel/supervisor/supervisor-service
npm run mcp

# Should output: "MCP Server running on stdio"
# Press Ctrl+C to stop
```

### 2. Test SSH connection:
```bash
# From your local machine
ssh samuel@your-vm-ip "cd /home/samuel/supervisor/supervisor-service && node dist/mcp/server.js" <<< '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Should return: List of MCP tools
```

### 3. Test in Claude.ai:
```
In Claude.ai Project:
"List all secrets"

Expected response:
Claude automatically uses mcp__meta__list_secrets tool
Returns JSON with secrets metadata
```

---

## Troubleshooting

### "Command not found: node"

**Fix:** Specify full path to node
```json
"command": "/usr/bin/node"
```

Or find it:
```bash
ssh samuel@your-vm-ip "which node"
```

### "Permission denied"

**Fix:** Check SSH key authentication
```bash
ssh-copy-id samuel@your-vm-ip
```

### "Database connection failed"

**Fix:** Check PostgreSQL is running on VM
```bash
ssh samuel@your-vm-ip "systemctl status postgresql"
```

### "ENCRYPTION_KEY must be set"

**Fix:** Verify .env file exists:
```bash
ssh samuel@your-vm-ip "cat /home/samuel/supervisor/supervisor-service/.env | grep ENCRYPTION_KEY"
```

---

## Benefits Summary

**Before (CLI only):**
- ❌ Must use Claude Code CLI (Sonnet only)
- ❌ SSH terminal required
- ❌ Desktop/laptop only
- ❌ No project isolation

**After (Claude.ai Projects):**
- ✅ Use Opus in browser for better planning
- ✅ Access from any device (phone, tablet, laptop)
- ✅ Project isolation (no context mixing)
- ✅ Dual MCP (supervisor + GitHub integration)
- ✅ Natural language interface

---

## Security Notes

1. **ENCRYPTION_KEY** - Keep this secret! It encrypts all secrets in database
2. **GITHUB_TOKEN** - Use fine-grained token with minimal permissions
3. **SSH keys** - Use passwordless keys for MCP connections
4. **Project scoping** - Consilio can't see OpenHorizon secrets (enforced by PROJECT_NAME)

---

## Next Steps

1. ✅ Create Claude.ai Projects (one per project)
2. ✅ Configure MCP servers in each project
3. ✅ Test with "List all secrets" command
4. ✅ Start planning with Opus!

**Happy planning! 🚀**
