-- Migration: Create supervisor_sessions table
-- Description: Stores Claude Code session information for each project

CREATE TABLE IF NOT EXISTS supervisor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(255) NOT NULL UNIQUE,
  claude_session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT valid_project_name CHECK (project_name ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_sessions_project_name ON supervisor_sessions(project_name);
CREATE INDEX idx_sessions_last_active ON supervisor_sessions(last_active);

COMMENT ON TABLE supervisor_sessions IS 'Persistent storage for Claude Code sessions per project';
COMMENT ON COLUMN supervisor_sessions.project_name IS 'Unique project identifier (matches directory name)';
COMMENT ON COLUMN supervisor_sessions.claude_session_id IS 'Claude SDK session ID for resume functionality';
COMMENT ON COLUMN supervisor_sessions.metadata IS 'Additional session data (working directory, MCP config, etc.)';
