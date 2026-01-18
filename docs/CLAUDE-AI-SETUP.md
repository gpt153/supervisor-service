# Quick Setup Guide - Claude.ai Projects

**5-minute setup for connecting Claude.ai browser projects to supervisor-service MCP.**

---

## For Each Project

### 1. Go to Claude.ai Projects

https://claude.ai/projects

### 2. Select Your Project

Click project name → Settings → MCP Servers

### 3. Add Supervisor-Service MCP

**Configuration format:**

```json
{
  "mcpServers": {
    "supervisor-service": {
      "transport": "sse",
      "url": "https://supermcp.153.se/sse?project=PROJECT_NAME"
    }
  }
}
```

**Replace `PROJECT_NAME` with:**
- `meta` - Full access (root supervisor)
- `consilio` - Consilio project only
- `health-agent` - Health-Agent project only
- `odin` - Odin project only

### 4. Add GitHub MCP (Optional)

**If your project needs GitHub access:**

```json
{
  "mcpServers": {
    "supervisor-service": {
      "transport": "sse",
      "url": "https://supermcp.153.se/sse?project=PROJECT_NAME"
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

**Get GitHub token:**
1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `read:org`
4. Copy token and paste in config

---

## Complete Examples

### Meta Project (Full Access)

**Project name:** Meta Supervisor

**Config:**
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

**Use for:**
- Cross-project operations
- Managing all secrets
- Port allocation overview
- System administration

---

### Consilio Project

**Project name:** Consilio

**Config:**
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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "consilio"
      }
    }
  }
}
```

**Access:**
- Secrets: `project/consilio/*` only
- Ports: Consilio range only
- Tasks: Consilio tasks only

---

### Health-Agent Project

**Project name:** Health Agent

**Config:**
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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "health-agent"
      }
    }
  }
}
```

**Access:**
- Secrets: `project/health-agent/*` only
- Ports: Health-Agent range only
- Tasks: Health-Agent tasks only

---

### Odin Project

**Project name:** Odin

**Config:**
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
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE",
        "GITHUB_OWNER": "gpt153",
        "GITHUB_REPO": "odin"
      }
    }
  }
}
```

**Access:**
- Secrets: `project/odin/*` only
- Ports: Odin range only
- Tasks: Odin tasks only

---

## Testing Your Connection

### After adding MCP config:

1. **Refresh the page** (Claude.ai sometimes needs this)
2. **Start a new chat in the project**
3. **Test with a simple command:**

```
List all secrets
```

**Expected response:**
```
{
  "success": true,
  "count": 0,
  "secrets": []
}
```

(Empty list is normal if no secrets stored yet)

### Store a test secret:

```
Store a test secret:
- Key: project/PROJECT_NAME/test_key
- Value: hello123
- Description: Test secret
- Type: api_key
- Provider: test
```

**Expected response:**
```
{
  "success": true,
  "keyPath": "project/PROJECT_NAME/test_key",
  "createdAt": "2026-01-18T12:00:00Z",
  "message": "Secret stored successfully"
}
```

### Retrieve it:

```
Retrieve secret: project/PROJECT_NAME/test_key
```

**Expected response:**
```
{
  "success": true,
  "keyPath": "project/PROJECT_NAME/test_key",
  "value": "hello123"
}
```

---

## Available MCP Tools

### In every project:

**Secrets:**
- `mcp__meta__store_secret` - Store encrypted secret
- `mcp__meta__retrieve_secret` - Retrieve decrypted secret
- `mcp__meta__list_secrets` - List all secrets (metadata only)

**Ports:**
- `mcp__meta__allocate_port` - Allocate next available port
- `mcp__meta__list_ports` - List port allocations
- `mcp__meta__get_port_utilization` - Get port usage stats
- `mcp__meta__release_port` - Release a port

**Tasks:**
- `mcp__meta__start_task` - Start timing a task
- `mcp__meta__complete_task` - Mark task complete
- `mcp__meta__get_task_stats` - Get execution statistics

**GitHub (if configured):**
- `create_issue` - Create GitHub issue
- `update_issue` - Update issue
- `list_issues` - List issues
- `get_file_contents` - Read file from repo
- `push_files` - Write files to repo
- `create_pull_request` - Create PR
- And many more...

---

## Common Commands

### Store API key:

```
Store our Stripe API key: sk_test_xyz123
Description: Stripe test environment key
```

### Allocate port:

```
Allocate a port for the API server
Service name: api-server
Cloudflare hostname: PROJECT-api.153.se
```

### Track task:

```
Start tracking this task:
- ID: epic-001-implementation
- Type: epic_implementation
- Description: Implementing user authentication
- Estimated: 30 minutes
```

### Create GitHub issue:

```
Create a GitHub issue:
Title: Implement JWT authentication
Body: (epic content from planning)
Labels: enhancement, backend
Assignees: scar
```

---

## Troubleshooting

### "Failed to connect to MCP server"

**Check:**
1. URL is correct: `https://supermcp.153.se/sse?project=PROJECT_NAME`
2. Project name matches (case-sensitive)
3. Server is running: `curl https://supermcp.153.se/health`

**Fix:**
1. Verify config in Claude.ai settings
2. Refresh page
3. Try different browser (clear cache)

---

### "Access denied: Project X can only access..."

**Cause:** Trying to access another project's resources

**Fix:**
- Use correct keyPath: `project/YOUR_PROJECT/*`
- Or switch to `meta` project for cross-project access

---

### "Secret not found"

**Cause:** Secret doesn't exist

**Fix:**
1. List all secrets to verify: `List all secrets`
2. Check keyPath spelling (case-sensitive)
3. Verify you're in correct project

---

## Security Notes

### Each project is isolated:

- **Consilio** sees only `project/consilio/*`
- **Health-Agent** sees only `project/health-agent/*`
- **Odin** sees only `project/odin/*`
- **Meta** sees everything (use sparingly)

### Never share:

- GitHub personal access tokens
- Encryption keys
- Production API keys in test projects

### Best practices:

- Use separate tokens for each project
- Store production secrets in `meta` project
- Use descriptive secret names
- Document what each secret is for

---

## Next Steps

1. ✅ Add MCP config to Claude.ai project
2. ✅ Test connection with health check
3. ✅ Store a test secret
4. ✅ Retrieve test secret
5. ✅ Allocate a test port
6. ✅ Start using real secrets/ports

**For detailed documentation:**
- Full guide: `/home/samuel/supervisor/supervisor-service/docs/BROWSER-CONNECTION.md`
- MCP tools reference: See "Available MCP Tools" section above

**Need help?**
- Check server status: `curl https://supermcp.153.se/health`
- View logs: `sudo journalctl -u supervisor-mcp-sse -f`
- Test connection: Use test secret command above
