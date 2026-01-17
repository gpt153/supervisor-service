# Supervisor Service - Connection Guide

**Service Status:** ✅ Running on port 8081
**Service PID:** Check with `ps aux | grep supervisor-service`
**Logs:** `tail -f /tmp/supervisor-service.log`

---

## 🌐 1. Web Dashboard (Easiest)

**URL:** http://localhost:8081

Access from browser to:
- View all projects and their status
- Trigger manual verifications
- See recent activity
- Real-time updates via Server-Sent Events

**From Remote (via SSH tunnel):**
```bash
# On your local machine:
ssh -L 8081:localhost:8081 samuel@your-vm-ip

# Then open: http://localhost:8081
```

---

## 🔌 2. MCP Server (Claude.ai Projects)

### Start MCP Server:
```bash
cd /home/samuel/.archon/workspaces/supervisor-service
npm run mcp
```

### Configure Claude.ai Projects:

1. **Open Claude.ai** → Projects → Your Project
2. **Project Settings** → MCP Servers
3. **Add Server:**
   ```json
   {
     "mcpServers": {
       "supervisor": {
         "command": "node",
         "args": ["/home/samuel/.archon/workspaces/supervisor-service/dist/mcp-server.js"],
         "env": {
           "DATABASE_URL": "postgresql://postgres@/supervisor_service?host=/var/run/postgresql&port=5434",
           "GITHUB_TOKEN": "your_github_token",
           "SUPERVISOR_ROOT": "/home/samuel/supervisor",
           "ARCHON_WORKSPACES": "/home/samuel/.archon/workspaces"
         }
       }
     }
   }
   ```

### Available MCP Tools (27 total):

**Planning Tools:**
- `list_epics` - List all epics for a project
- `read_epic` - Read epic content
- `list_adrs` - List Architecture Decision Records
- `read_workflow_status` - Get project status

**Git Tools:**
- `git_status` - Get git status
- `git_commit` - Create commit
- `git_push` - Push to remote
- `git_log` - Recent commits

**GitHub Tools:**
- `list_issues` - List GitHub issues
- `read_issue` - Get issue details
- `create_issue` - Create new issue
- `comment_issue` - Add comment
- `close_issue` - Close issue

**SCAR Monitoring:**
- `check_scar_progress` - Check SCAR activity
- `list_worktrees` - List active worktrees
- `read_worktree_files` - List files in worktree

**Verification:**
- `trigger_verification` - Run verification
- `get_verification_results` - Get results
- `run_build` - Execute build
- `run_tests` - Execute tests

**Knowledge Base:**
- `search_learnings` - Search learnings
- `read_learning` - Read learning document
- `list_docs` - List documentation
- `read_doc` - Read documentation

### Example Usage in Claude.ai:

```
You: "List all epics for consilio project"
Claude: [Uses list_epics tool with project="consilio"]

You: "Check SCAR's progress on issue #145"
Claude: [Uses check_scar_progress tool]

You: "Create a GitHub issue for adding authentication"
Claude: [Uses create_issue tool]
```

---

## 📡 3. REST API

**Base URL:** http://localhost:8081/api

### Authentication:

**Option A: JWT Token**
```bash
# Get token (would need login endpoint - not implemented yet)
# For now, use API key
```

**Option B: API Key** (Current)
```bash
# Add to .env:
API_KEYS=your-secret-key-123

# Use in requests:
curl -H "X-API-Key: your-secret-key-123" http://localhost:8081/api/projects
```

### Available Endpoints:

**Projects:**
```bash
# List all projects
curl http://localhost:8081/api/projects

# Get project status
curl http://localhost:8081/api/projects/consilio/status

# Send command to project
curl -X POST http://localhost:8081/api/projects/consilio/command \
  -H "Content-Type: application/json" \
  -d '{"command": "Check status of issue #145"}'

# List project issues
curl http://localhost:8081/api/projects/consilio/issues
```

**Verification:**
```bash
# Trigger verification
curl -X POST http://localhost:8081/api/projects/consilio/verify/145

# Get verification results
curl http://localhost:8081/api/verification/{result-id}
```

---

## 💬 4. Telegram Bot (Optional)

### Setup:

1. **Create Bot:**
   ```
   - Message @BotFather on Telegram
   - Send: /newbot
   - Follow instructions
   - Get your bot token
   ```

2. **Configure:**
   ```bash
   # Add to .env:
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_ENABLED=true
   ```

3. **Restart Service:**
   ```bash
   pkill -f "node dist/index.js"
   cd /home/samuel/.archon/workspaces/supervisor-service
   npm start
   ```

### Bot Commands:

```
/start - Initialize bot
/help - Show help
/status - Get project status
/switch <project> - Switch to project
/verify <issue> - Trigger verification
/projects - List all projects
```

---

## 🔔 5. GitHub Webhooks (Automated Verification)

### Setup Webhook:

1. **Get Webhook Secret:**
   ```bash
   cd /home/samuel/.archon/workspaces/supervisor-service
   grep GITHUB_WEBHOOK_SECRET .env
   ```

2. **Configure in GitHub:**
   - Go to: https://github.com/gpt153/consilio/settings/hooks
   - Click: "Add webhook"
   - Payload URL: `http://your-vm-ip:8081/webhooks/github`
   - Content type: `application/json`
   - Secret: [paste GITHUB_WEBHOOK_SECRET from .env]
   - Events: Select "Issue comments" and "Issues"
   - Click: "Add webhook"

3. **Repeat for Each Project:**
   - consilio
   - openhorizon.cc
   - health-agent
   - odin
   - supervisor-service

### How It Works:

```
SCAR posts "Implementation complete" on issue
   ↓
GitHub sends webhook to your service
   ↓
Service validates signature
   ↓
Identifies project from repository
   ↓
Triggers automated verification
   ↓
Runs: build, tests, mock detection
   ↓
Posts results back to GitHub issue
   ↓
You see results when you check GitHub!
```

---

## 🔧 Service Management

### Check Status:
```bash
curl http://localhost:8081/health
```

### View Logs:
```bash
tail -f /tmp/supervisor-service.log
```

### Restart Service:
```bash
pkill -f "node dist/index.js"
cd /home/samuel/.archon/workspaces/supervisor-service
npm start > /tmp/supervisor-service.log 2>&1 &
```

### Check Database:
```bash
psql -U postgres -d supervisor_service -c "SELECT COUNT(*) FROM supervisor_sessions;"
```

---

## 🚀 Quick Start Checklist

- [x] Service deployed and running
- [x] Database configured
- [ ] Set ANTHROPIC_API_KEY in .env (required for Claude Code instances)
- [ ] Configure GitHub webhooks for projects
- [ ] (Optional) Set up Telegram bot
- [ ] (Optional) Configure MCP server for Claude.ai Projects

---

## 📝 Important Notes

1. **ANTHROPIC_API_KEY Required:**
   - Service runs without it, but can't spawn Claude Code instances
   - Get from: https://console.anthropic.com/
   - Add to: `/home/samuel/.archon/workspaces/supervisor-service/.env`
   - Format: `ANTHROPIC_API_KEY=sk-ant-...`

2. **GitHub Token:**
   - Already configured (from gh CLI)
   - Used for GitHub API calls
   - Stored in .env

3. **Security:**
   - Service runs on localhost (not exposed)
   - Use SSH tunnels for remote access
   - GitHub webhooks use signature validation
   - API keys for REST API authentication

4. **Projects:**
   - Service discovers projects from: `/home/samuel/supervisor/*/`
   - Each project needs CLAUDE.md file
   - Implementation in: `/home/samuel/.archon/workspaces/*/`

---

## 🎯 Next Steps

1. **Add Anthropic API Key:**
   ```bash
   cd /home/samuel/.archon/workspaces/supervisor-service
   nano .env
   # Add: ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

2. **Test with Project:**
   ```bash
   curl -X POST http://localhost:8081/api/projects/consilio/command \
     -H "Content-Type: application/json" \
     -d '{"command": "List all epics"}'
   ```

3. **Configure Claude.ai Projects** (for mobile/web access)

4. **Set up GitHub webhooks** (for automated verification)

---

**Service URL:** http://localhost:8081
**Health Check:** http://localhost:8081/health
**Dashboard:** http://localhost:8081
**Logs:** /tmp/supervisor-service.log
