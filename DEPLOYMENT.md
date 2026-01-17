# Supervisor Service - Deployment Guide

This guide covers deploying the supervisor-service in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Systemd Deployment](#systemd-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- Node.js 20+ (for local/systemd deployment)
- PostgreSQL 15+
- Git
- Anthropic API key
- GitHub Personal Access Token

### Optional

- Docker and Docker Compose (for containerized deployment)
- Telegram Bot Token (for Telegram adapter)
- SSL certificate (for production)

## Docker Deployment

### Quick Start

1. Clone the repository and build:

```bash
git clone <repository-url>
cd supervisor-service
```

2. Create `.env` file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start services:

```bash
docker-compose up -d
```

4. Check logs:

```bash
docker-compose logs -f supervisor-service
```

5. Health check:

```bash
curl http://localhost:8080/health
```

### Production Docker Deployment

For production, use a reverse proxy (nginx/traefik) with SSL:

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - supervisor-service

  supervisor-service:
    # ... same as docker-compose.yml
    expose:
      - "8080"
    ports: []  # Don't expose directly
```

## Systemd Deployment

### Installation

1. Build the application:

```bash
npm install
npm run build
```

2. Create service user:

```bash
sudo useradd -r -s /bin/false supervisor
```

3. Install to system directory:

```bash
sudo mkdir -p /opt/supervisor-service
sudo cp -r dist node_modules package.json /opt/supervisor-service/
sudo cp .env /opt/supervisor-service/
sudo chown -R supervisor:supervisor /opt/supervisor-service
```

4. Install systemd service:

```bash
sudo cp systemd/supervisor-service.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable supervisor-service
```

5. Start the service:

```bash
sudo systemctl start supervisor-service
```

6. Check status:

```bash
sudo systemctl status supervisor-service
sudo journalctl -u supervisor-service -f
```

### Service Management

```bash
# Start
sudo systemctl start supervisor-service

# Stop
sudo systemctl stop supervisor-service

# Restart
sudo systemctl restart supervisor-service

# Status
sudo systemctl status supervisor-service

# Logs
sudo journalctl -u supervisor-service -n 100 -f
```

## Configuration

### Environment Variables

All configuration is done via environment variables. See `.env.example` for all options.

#### Required Variables

```bash
# Claude API
ANTHROPIC_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/supervisor_service
DATABASE_PASSWORD=your_secure_password

# GitHub
GITHUB_TOKEN=ghp_xxx
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

#### Optional Adapters

```bash
# Telegram Bot (optional)
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# Web Dashboard (optional, enabled by default)
WEB_DASHBOARD_ENABLED=true

# REST API (optional, enabled by default)
REST_API_ENABLED=true
JWT_SECRET=your_jwt_secret_here
API_KEYS=key1,key2,key3
```

### Database Setup

1. Create database:

```bash
createdb supervisor_service
```

2. Run migrations:

```bash
npm run db:migrate
# or manually:
psql supervisor_service < db/schema.sql
```

### GitHub Webhook Setup

1. Go to your GitHub repository settings
2. Add webhook with URL: `https://your-domain.com/webhooks/github`
3. Set content type to `application/json`
4. Set secret to match `GITHUB_WEBHOOK_SECRET`
5. Select events: `Issues`, `Issue comments`, `Pull requests`

### Telegram Bot Setup

1. Create bot via @BotFather on Telegram
2. Get bot token
3. Set `TELEGRAM_ENABLED=true` and `TELEGRAM_BOT_TOKEN=<token>`
4. Start service
5. Send `/start` to your bot

## Monitoring

### Health Checks

```bash
# Basic health check
curl http://localhost:8080/health

# Response:
{
  "status": "healthy",
  "timestamp": "2026-01-17T17:00:00.000Z",
  "database": "connected",
  "activeProjects": 3
}
```

### Metrics

Monitor these key metrics:

- **HTTP Response Time**: Should be < 1s
- **Active Sessions**: Number of active Claude sessions
- **Database Connections**: Should stay below pool limit
- **Memory Usage**: Should remain stable
- **CPU Usage**: Should be < 50% normally

### Logging

Logs are written to:
- **Docker**: `docker-compose logs`
- **Systemd**: `journalctl -u supervisor-service`

Log levels:
- `info`: Normal operations
- `warn`: Non-critical issues
- `error`: Critical errors

## Troubleshooting

### Service Won't Start

1. Check logs:
```bash
sudo journalctl -u supervisor-service -n 50
```

2. Verify database connection:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

3. Check environment variables:
```bash
sudo systemctl show supervisor-service | grep Environment
```

### High Memory Usage

Claude sessions can use significant memory. Monitor with:

```bash
# Docker
docker stats supervisor-service

# Systemd
systemctl status supervisor-service
```

Adjust memory limits in docker-compose.yml or systemd service.

### Database Connection Issues

1. Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

2. Test connection:
```bash
psql $DATABASE_URL -c "SELECT NOW()"
```

3. Check connection pool settings in code

### Telegram Bot Not Responding

1. Verify token is correct
2. Check bot is started:
```bash
docker-compose logs -f supervisor-service | grep -i telegram
```

3. Test webhook:
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### GitHub Webhooks Not Processing

1. Check webhook delivery in GitHub settings
2. Verify webhook secret matches
3. Check webhook queue:
```bash
psql $DATABASE_URL -c "SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10"
```

## Security Considerations

### API Keys

- **JWT Secret**: Use strong random string (32+ chars)
- **API Keys**: Use UUID or similar strong random values
- **Database Password**: Use strong password (16+ chars)
- **GitHub Token**: Use fine-grained token with minimal permissions

### Network Security

- Use HTTPS/TLS in production
- Restrict database access to localhost
- Use firewall to limit access to port 8080
- Consider using VPN for Telegram bot

### File Permissions

```bash
# Secure .env file
chmod 600 /opt/supervisor-service/.env

# Secure service directory
chown -R supervisor:supervisor /opt/supervisor-service
chmod 750 /opt/supervisor-service
```

## Backup and Recovery

### Database Backup

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Configuration Backup

```bash
# Backup .env and configs
tar -czf config-backup.tar.gz .env systemd/
```

## Performance Tuning

### Database

```sql
-- Optimize for read-heavy workload
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
```

### Node.js

```bash
# Increase heap size if needed
NODE_OPTIONS="--max-old-space-size=4096" node dist/index.js
```

## Support

For issues or questions:
- Check logs first
- Review GitHub issues
- Contact support team

## License

See LICENSE file for details.
