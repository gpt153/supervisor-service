# Claude Code OAuth Token Setup

## Why OAuth Instead of API Key?

OAuth tokens work with Claude Pro/Max subscriptions, while API keys require separate billing.

**Benefits:**
- Use your existing Claude Pro/Max subscription
- No additional API costs
- Same credits as web/mobile Claude

---

## How to Get OAuth Token

### Method 1: Using Claude Code CLI (Easiest)

```bash
# Run the oauth command
claude code oauth

# This will:
# 1. Open browser for authentication
# 2. Save token to ~/.claude/config
# 3. Display the token

# Copy the token that's displayed
```

### Method 2: Manual Extraction

```bash
# Token is stored in Claude config
cat ~/.claude/config | jq -r '.oauthToken'

# Or with python
python3 -c "import json; print(json.load(open('~/.claude/config'.replace('~', '$HOME')))['oauthToken'])"
```

---

## Configure Supervisor Service

### 1. Add Token to .env

```bash
cd /home/samuel/.archon/workspaces/supervisor-service
nano .env

# Add this line:
CLAUDE_CODE_OAUTH_TOKEN=your_token_here

# Remove or comment out:
#ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Restart Service

```bash
./service.sh restart
```

### 3. Verify

```bash
# Check logs
tail -f /tmp/supervisor-service.log

# Test health
curl http://localhost:8081/health
```

---

## How It Works

The Claude Agent SDK checks for credentials in this order:

1. **CLAUDE_CODE_OAUTH_TOKEN** environment variable (preferred)
2. **ANTHROPIC_API_KEY** environment variable (fallback)
3. **~/.claude/config** file (automatic)

So you can either:
- Set CLAUDE_CODE_OAUTH_TOKEN in .env ✅ Recommended
- Remove both env vars and SDK reads from ~/.claude/config automatically

---

## Token Expiration

OAuth tokens expire after some time. If you see authentication errors:

```bash
# Refresh token
claude code oauth

# Get new token
cat ~/.claude/config | jq -r '.oauthToken'

# Update .env
cd /home/samuel/.archon/workspaces/supervisor-service
nano .env
# Update CLAUDE_CODE_OAUTH_TOKEN

# Restart
./service.sh restart
```

---

## Troubleshooting

### "Authentication failed"

**Cause:** Token expired or invalid

**Fix:**
```bash
# Re-authenticate
claude code oauth

# Update token in .env
```

### "No OAuth token found"

**Cause:** Token not set in .env or config file

**Fix:**
```bash
# Check if token exists in config
cat ~/.claude/config | jq .

# If missing, run:
claude code oauth

# Then update .env
```

### Service won't start

**Cause:** Both ANTHROPIC_API_KEY and CLAUDE_CODE_OAUTH_TOKEN missing

**Fix:**
```bash
# Set one of them in .env
cd /home/samuel/.archon/workspaces/supervisor-service
nano .env

# Add OAuth token (preferred):
CLAUDE_CODE_OAUTH_TOKEN=your_token

# Or API key:
ANTHROPIC_API_KEY=sk-ant-your_key
```

---

## Current Setup

**Configured:** Uses OAuth token from environment variable
**Billing:** Uses your Claude Pro/Max subscription
**No additional costs!**

---

## Test It Works

```bash
# Send a test command via API
curl -X POST http://localhost:8081/api/projects/consilio/command \
  -H "Content-Type: application/json" \
  -d '{"command": "List all epics"}'

# Should return project supervisorstatus
```

If it works, you're using OAuth successfully! ✅
