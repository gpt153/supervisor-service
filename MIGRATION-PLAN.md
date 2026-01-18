# Supervisor-Service Migration Plan

**Goal:** Replace old implementation with new PostgreSQL-based foundation

**Status:** Ready to execute

---

## What We Have

### Old Implementation (currently in gpt153/supervisor-service)
- Express HTTP server
- SSE-based MCP
- Simple file-based approach
- 27 MCP tools for planning
- Works but not aligned with PRD/Tech Spec

### New Implementation (just built in planning repo)
- PostgreSQL-based (11 tables)
- SecretsManager with AES-256-GCM encryption
- PortManager with guaranteed conflict prevention
- TaskTimer with data-driven estimation
- Project-scoped MCP for Claude.ai Projects
- Matches PRD, Tech Spec, Epic Breakdown

---

## Migration Steps

### Step 1: Backup Old Implementation
```bash
cd /tmp/supervisor-service
git checkout -b legacy-implementation
git push origin legacy-implementation
```
**Result:** Old code preserved in `legacy-implementation` branch

### Step 2: Replace with New Code
```bash
cd /tmp/supervisor-service
git checkout main

# Remove old code (keep .git, README.md for reference)
rm -rf src/ migrations/ scripts/ *.md *.json *.ts

# Copy new implementation
cp -r /home/samuel/supervisor/supervisor-service/src/ .
cp -r /home/samuel/supervisor/supervisor-service/docs/ .
cp /home/samuel/supervisor/supervisor-service/package.json .
cp /home/samuel/supervisor/supervisor-service/tsconfig.json .
cp /home/samuel/supervisor/supervisor-service/.env.example .
cp /home/samuel/supervisor/supervisor-service/.gitignore .

# Create new README
cat > README.md << 'EOF'
# Supervisor Service

**Meta-supervisor infrastructure for managing multiple AI-developed projects**

PostgreSQL-based service providing MCP tools for:
- Encrypted secrets management
- Port allocation and conflict prevention
- Task timing and estimation
- Cloudflare DNS/tunnel integration
- GCloud VM management

## Quick Start

See: [docs/CLAUDE-AI-PROJECTS-SETUP.md](docs/CLAUDE-AI-PROJECTS-SETUP.md)

## Documentation

- [PRD](https://github.com/gpt153/supervisor/blob/main/supervisor-service/PRD-supervisor-service.md) - Planning repo
- [Technical Spec](https://github.com/gpt153/supervisor/blob/main/supervisor-service/TECHNICAL-SPEC-supervisor-service.md) - Planning repo
- [Epic Breakdown](https://github.com/gpt153/supervisor/blob/main/supervisor-service/EPIC-BREAKDOWN-supervisor-service.md) - Planning repo

## Architecture

Built from comprehensive planning docs in `gpt153/supervisor` repository.

**Planning artifacts:** gpt153/supervisor/supervisor-service/
**Implementation code:** gpt153/supervisor-service/ (this repo)

EOF

# Commit
git add .
git commit -m "feat: Replace with PostgreSQL-based implementation

Complete rewrite based on PRD, Technical Spec, and Epic Breakdown.

New features:
- PostgreSQL schema (11 tables)
- AES-256-GCM encrypted secrets
- Port allocation system (100 ports per project)
- Task timing and estimation
- Project-scoped MCP for Claude.ai Projects
- Cloudflare/GCloud integration foundations

Old implementation preserved in legacy-implementation branch.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push
git push origin main
```

### Step 3: Set Up Workspace
```bash
# Clone to Archon workspace (where SCAR expects it)
cd /home/samuel/.archon/workspaces
rm -rf supervisor-service  # Remove if exists
git clone https://github.com/gpt153/supervisor-service.git

# Install and build
cd supervisor-service
npm install
npm run build

# Run database setup
node dist/db/setup.js
```

### Step 4: Update Planning Repo
```bash
cd /home/samuel/supervisor/supervisor-service

# Keep only planning artifacts
rm -rf src/ dist/ node_modules/ .env package*.json tsconfig.json
rm -rf *.md  # We'll keep planning docs only

# These stay in planning repo:
# - PRD-supervisor-service.md
# - TECHNICAL-SPEC-supervisor-service.md
# - EPIC-BREAKDOWN-supervisor-service.md
# - .bmad/ directory

# Create README pointing to implementation
cat > README.md << 'EOF'
# Supervisor Service - Planning

**Planning artifacts for supervisor-service**

## Implementation Repository

Code: https://github.com/gpt153/supervisor-service

## Planning Documents

- [PRD](PRD-supervisor-service.md) - Product Requirements
- [Technical Spec](TECHNICAL-SPEC-supervisor-service.md) - Architecture
- [Epic Breakdown](EPIC-BREAKDOWN-supervisor-service.md) - Implementation plan

## Two-Repository System

**Planning:** gpt153/supervisor/supervisor-service/ (this directory)
**Implementation:** gpt153/supervisor-service/ (code repo)

SCAR implements features in the implementation repo.
EOF

# Commit planning repo changes
git add .
git commit -m "docs: Move implementation to separate repo

Implementation code moved to: gpt153/supervisor-service
This directory now contains only planning artifacts.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

git push origin main
```

---

## Result

**After migration:**

```
gpt153/supervisor (planning)
  └── supervisor-service/
      ├── PRD-supervisor-service.md
      ├── TECHNICAL-SPEC-supervisor-service.md
      ├── EPIC-BREAKDOWN-supervisor-service.md
      ├── .bmad/
      └── README.md (points to implementation)

gpt153/supervisor-service (implementation)
  └── (our new code)
      ├── src/
      ├── docs/
      ├── package.json
      └── README.md

/home/samuel/.archon/workspaces/supervisor-service/
  └── (cloned from gpt153/supervisor-service)
      └── (where SCAR works)
```

**Benefits:**
- ✅ Clean separation (planning vs code)
- ✅ Old code preserved in branch
- ✅ Matches other projects' structure
- ✅ SCAR can implement remaining epics
- ✅ Claude.ai Projects can connect

---

## Next Steps After Migration

1. **Create GitHub issues for remaining epics:**
   - Epic 5: Cloudflare API integration
   - Epic 6: GCloud API integration
   - Epic 9: Learning system integration
   - Epic 10: PIV loop implementation
   - Epic 11: Multi-project MCP endpoints
   - Epic 12: Automatic secret detection

2. **Configure Claude.ai Projects:**
   - Follow: docs/CLAUDE-AI-PROJECTS-SETUP.md
   - Create separate Projects for Consilio, OpenHorizon, Meta

3. **SCAR implements remaining features:**
   - You supervise via GitHub issues
   - Verify implementation before merging

---

**Ready to execute?** Just say "yes" and I'll run all commands.
