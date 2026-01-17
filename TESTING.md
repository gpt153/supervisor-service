# Supervisor Service - Testing Guide

This guide covers testing all components of the supervisor-service, including the new Phase 4 adapters.

## Table of Contents

- [Manual Testing](#manual-testing)
- [Telegram Bot Testing](#telegram-bot-testing)
- [Web Dashboard Testing](#web-dashboard-testing)
- [REST API Testing](#rest-api-testing)
- [Integration Testing](#integration-testing)
- [Performance Testing](#performance-testing)

## Manual Testing

### Prerequisites

1. Start the service:
```bash
npm run dev
```

2. Verify service is running:
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T17:00:00.000Z",
  "database": "connected",
  "activeProjects": 0
}
```

## Telegram Bot Testing

### Setup

1. Create Telegram bot via @BotFather
2. Get bot token
3. Set environment variables:
```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your_token_here
```

4. Restart service

### Test Cases

#### TC1: Start Command
```
Send: /start
Expected: Welcome message with available commands
```

#### TC2: Help Command
```
Send: /help
Expected: Detailed help message with all commands
```

#### TC3: Status Command
```
Send: /status
Expected: List of all projects with their status
```

#### TC4: Switch Project
```
Send: /switch consilio
Expected: Confirmation message "Switched to project: consilio"
```

#### TC5: Send Command
```
Send: Show me the latest issues
Expected: Response from Claude with issue list
```

#### TC6: Verify Command
```
Send: /verify
Expected: Verification started message
```

#### TC7: Natural Language Switching
```
Send: switch to openhorizon
Expected: Switched to openhorizon project
```

### Expected Behaviors

- Bot should respond within 2-3 seconds
- Long responses should be split into multiple messages
- Markdown formatting should work correctly
- Session should persist across messages

## Web Dashboard Testing

### Access Dashboard

```bash
# Open in browser
http://localhost:8080/
```

### Test Cases

#### TC1: Dashboard Loads
```
Action: Open dashboard URL
Expected: Dashboard displays with 4 stat cards and project grid
```

#### TC2: Project List
```
Action: Wait for projects to load
Expected: All active projects displayed in cards with status
```

#### TC3: View Project
```
Action: Click "View" button on a project
Expected: Alert with project status JSON
```

#### TC4: Verify Project
```
Action: Click "Verify" button on a project
Expected: Confirmation dialog, then success message
```

#### TC5: Refresh Project
```
Action: Click "Refresh" button
Expected: Project list refreshes
```

#### TC6: Activity Log
```
Action: Scroll to activity log section
Expected: Recent activities displayed with timestamps
```

#### TC7: Real-time Updates
```
Action: Trigger verification from another client
Expected: Dashboard updates automatically via SSE
```

### Expected Behaviors

- Dashboard should load within 2 seconds
- Stats should update when projects change
- Activity log should show recent events
- Real-time updates should appear without refresh

## REST API Testing

### Setup Authentication

```bash
# Generate test API key (or use from .env)
API_KEY="test-key-123"

# All requests need Authorization header
```

### Test Cases

#### TC1: Health Check (No Auth)
```bash
curl http://localhost:8080/api/v1/health

Expected:
{
  "status": "healthy",
  "timestamp": "...",
  "uptime": 123.45
}
```

#### TC2: List Projects
```bash
curl -H "Authorization: ApiKey ${API_KEY}" \
  http://localhost:8080/api/v1/projects

Expected:
{
  "projects": [
    {
      "name": "consilio",
      "sessionId": "...",
      "sessionActive": true,
      "lastActive": "...",
      "createdAt": "..."
    }
  ],
  "count": 1
}
```

#### TC3: Get Project Status
```bash
curl -H "Authorization: ApiKey ${API_KEY}" \
  http://localhost:8080/api/v1/projects/consilio/status

Expected:
{
  "project": {
    "name": "consilio",
    "sessionId": "...",
    "sessionActive": true,
    ...
  }
}
```

#### TC4: Send Command
```bash
curl -X POST \
  -H "Authorization: ApiKey ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"command":"Show me project status"}' \
  http://localhost:8080/api/v1/projects/consilio/command

Expected:
{
  "success": true,
  "response": "Claude's response here..."
}
```

#### TC5: List Issues
```bash
curl -H "Authorization: ApiKey ${API_KEY}" \
  http://localhost:8080/api/v1/projects/consilio/issues

Expected:
{
  "project": "consilio",
  "issues": [...],
  "count": 1
}
```

#### TC6: Trigger Verification
```bash
curl -X POST \
  -H "Authorization: ApiKey ${API_KEY}" \
  http://localhost:8080/api/v1/projects/consilio/verify/123

Expected:
{
  "success": true,
  "message": "Verification scheduled"
}
```

#### TC7: Invalid Auth
```bash
curl -H "Authorization: ApiKey invalid" \
  http://localhost:8080/api/v1/projects

Expected: 401 Unauthorized
{
  "error": "Invalid API key"
}
```

#### TC8: Rate Limiting
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl -H "Authorization: ApiKey ${API_KEY}" \
    http://localhost:8080/api/v1/health &
done
wait

Expected: First 100 succeed, 101st returns 429 Too Many Requests
```

### JWT Testing

#### Generate JWT Token
```bash
# Using your JWT secret
JWT_SECRET="your_jwt_secret"

# You'll need to implement token generation
# Example using Node.js:
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 'user123' }, '${JWT_SECRET}', { expiresIn: '24h' });
console.log(token);
"
```

#### Use JWT Token
```bash
TOKEN="your_generated_token"

curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:8080/api/v1/projects
```

## Integration Testing

### Test Scenario 1: Complete Workflow

1. Start service with all adapters enabled
2. Create project via MCP
3. Send command via Telegram
4. View status on Web Dashboard
5. Trigger verification via REST API
6. Check results via all interfaces

### Test Scenario 2: Multi-Project Management

1. Create 3 projects
2. Send commands to each via different interfaces
3. Verify all sessions remain active
4. Check cross-project status consistency

### Test Scenario 3: Error Handling

1. Send invalid command
2. Try to access non-existent project
3. Test with invalid authentication
4. Simulate database disconnection
5. Verify graceful error handling

## Performance Testing

### Load Testing

#### Test 1: Concurrent Requests
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test 100 concurrent requests
ab -n 1000 -c 100 -H "Authorization: ApiKey ${API_KEY}" \
  http://localhost:8080/api/v1/projects
```

Expected:
- 95% requests < 1000ms
- 99% requests < 2000ms
- 0% failed requests

#### Test 2: Sustained Load
```bash
# Test sustained load for 5 minutes
ab -t 300 -c 10 -H "Authorization: ApiKey ${API_KEY}" \
  http://localhost:8080/api/v1/health
```

Expected:
- Memory usage stable
- No memory leaks
- Response times consistent

### Memory Testing

```bash
# Monitor memory usage
watch -n 1 'ps aux | grep "node.*index.js"'
```

Expected:
- Baseline: ~100-200 MB
- With 3 active sessions: ~300-500 MB
- Should not exceed 1 GB under normal load

### Database Performance

```bash
# Monitor database connections
psql ${DATABASE_URL} -c "
SELECT count(*) as connections 
FROM pg_stat_activity 
WHERE datname='supervisor_service'
"
```

Expected:
- Idle: 1-2 connections
- Active: 5-10 connections
- Should not exceed pool limit (20)

## Troubleshooting Test Failures

### Telegram Bot Not Responding

1. Check token is valid:
```bash
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe
```

2. Check service logs:
```bash
docker-compose logs -f supervisor-service | grep -i telegram
```

### Dashboard Not Loading

1. Check static files are served:
```bash
curl http://localhost:8080/ | grep "Supervisor Service Dashboard"
```

2. Check browser console for errors

3. Verify API endpoints work:
```bash
curl http://localhost:8080/api/projects
```

### API Authentication Failing

1. Verify API key is in config:
```bash
echo $API_KEYS
```

2. Check header format:
```bash
# Correct:
Authorization: ApiKey your-key-here

# Incorrect:
Authorization: Bearer your-key-here  # This is for JWT
```

### SSE Not Working

1. Check EventSource connection in browser console

2. Verify SSE endpoint:
```bash
curl -N http://localhost:8080/api/events
```

Expected: Stream of events

### High Response Times

1. Check database query performance:
```bash
psql ${DATABASE_URL} -c "
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10
"
```

2. Check Claude API response times in logs

3. Monitor system resources:
```bash
htop
```

## Continuous Testing

### Pre-deployment Checklist

- [ ] All unit tests pass
- [ ] Build succeeds without errors
- [ ] Health check returns healthy
- [ ] Database migrations applied
- [ ] All adapters start successfully
- [ ] Telegram bot responds
- [ ] Web dashboard loads
- [ ] REST API authentication works
- [ ] SSE connection establishes
- [ ] No memory leaks after 1 hour
- [ ] Response times under thresholds

### Automated Testing (TODO)

Future improvements:
- Jest unit tests for all modules
- Integration tests with test database
- E2E tests with Playwright
- Load tests in CI/CD
- Security scanning
- Dependency vulnerability checks

## Support

For test failures or issues:
1. Check logs first
2. Review relevant section above
3. Check GitHub issues
4. Contact support team

## License

See LICENSE file.
