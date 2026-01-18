-- Supervisor Service Database Schema
-- Version: 1.0.0
-- Description: Multi-project orchestration system with secrets, ports, timing, and knowledge management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- For encryption functions
CREATE EXTENSION IF NOT EXISTS vector;     -- For RAG embeddings (pgvector)

-- ============================================================================
-- SECRETS MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS secrets (
  id SERIAL PRIMARY KEY,
  key_path TEXT NOT NULL UNIQUE,  -- Hierarchical: meta/cloudflare/api_token, project/consilio/stripe_key
  encrypted_value BYTEA NOT NULL,  -- AES-256-GCM encrypted
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by TEXT,  -- User or supervisor that created it
  description TEXT,  -- Optional description of what this secret is for

  -- Metadata
  secret_type TEXT,  -- api_key, token, password, certificate, etc.
  provider TEXT,     -- anthropic, openai, cloudflare, gcloud, stripe, etc.

  -- Constraints
  CHECK (key_path ~ '^[a-z0-9/_-]+$'),  -- Only lowercase, numbers, /, _, -
  CHECK (length(encrypted_value) > 0)
);

CREATE INDEX idx_secrets_key_path ON secrets(key_path);
CREATE INDEX idx_secrets_provider ON secrets(provider);
CREATE INDEX idx_secrets_created_at ON secrets(created_at);

-- ============================================================================
-- PORT ALLOCATION SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_port_ranges (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  project_name TEXT NOT NULL UNIQUE,
  port_range_start INTEGER NOT NULL,
  port_range_end INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (port_range_start >= 3000 AND port_range_start <= 65535),
  CHECK (port_range_end >= 3000 AND port_range_end <= 65535),
  CHECK (port_range_end - port_range_start = 99),  -- Exactly 100 ports
  CHECK (project_name ~ '^[a-z0-9-]+$')  -- Only lowercase, numbers, hyphens
);

CREATE UNIQUE INDEX idx_port_ranges_start ON project_port_ranges(port_range_start);
CREATE UNIQUE INDEX idx_port_ranges_end ON project_port_ranges(port_range_end);

CREATE TABLE IF NOT EXISTS port_allocations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES project_port_ranges(project_id),
  port INTEGER NOT NULL UNIQUE,
  service_name TEXT NOT NULL,
  description TEXT,
  cloudflare_hostname TEXT,  -- Optional: service.153.se
  allocated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  allocated_by TEXT,  -- Supervisor or user that allocated it
  status TEXT NOT NULL DEFAULT 'active',  -- active, released

  -- Constraints
  CHECK (port >= 3000 AND port <= 65535),
  CHECK (status IN ('active', 'released'))
);

CREATE INDEX idx_port_allocations_project ON port_allocations(project_id);
CREATE INDEX idx_port_allocations_port ON port_allocations(port);
CREATE INDEX idx_port_allocations_status ON port_allocations(status);

-- Ensure allocated port is within project's range
CREATE OR REPLACE FUNCTION check_port_within_range()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM project_port_ranges
    WHERE project_id = NEW.project_id
    AND NEW.port >= port_range_start
    AND NEW.port <= port_range_end
  ) THEN
    RAISE EXCEPTION 'Port % is outside project % range', NEW.port, NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_port_within_range
  BEFORE INSERT OR UPDATE ON port_allocations
  FOR EACH ROW
  EXECUTE FUNCTION check_port_within_range();

-- ============================================================================
-- TASK TIMING & ESTIMATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_executions (
  id SERIAL PRIMARY KEY,
  task_id TEXT NOT NULL,  -- Unique identifier for this task run
  task_type TEXT NOT NULL,  -- file_search, code_generation, epic_creation, etc.
  task_description TEXT NOT NULL,

  -- Timing
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  estimated_seconds INTEGER,  -- Estimate given before execution
  estimation_error NUMERIC,   -- (actual - estimated) / actual

  -- Context
  project_name TEXT,
  epic_id TEXT,
  issue_number INTEGER,
  model_used TEXT,  -- sonnet, haiku, opus

  -- Metadata
  complexity TEXT,  -- simple, moderate, complex
  files_changed INTEGER,
  lines_changed INTEGER,
  parallel_execution BOOLEAN DEFAULT FALSE,
  parent_task_id TEXT,  -- If this is a subtask

  -- Outcome
  status TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed
  error_message TEXT,

  -- Constraints
  CHECK (status IN ('running', 'completed', 'failed')),
  CHECK (complexity IN ('simple', 'moderate', 'complex'))
);

CREATE INDEX idx_task_executions_type ON task_executions(task_type);
CREATE INDEX idx_task_executions_project ON task_executions(project_name);
CREATE INDEX idx_task_executions_started ON task_executions(started_at);
CREATE INDEX idx_task_executions_status ON task_executions(status);
CREATE INDEX idx_task_executions_desc_fts ON task_executions USING gin(to_tsvector('english', task_description));

-- ============================================================================
-- LEARNING SYSTEM (RAG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id SERIAL PRIMARY KEY,
  chunk_id TEXT NOT NULL UNIQUE,  -- learning-006-chunk-1
  source_file TEXT NOT NULL,  -- learnings/006-never-trust-scar.md
  chunk_text TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small

  -- Metadata
  category TEXT,  -- context-management, scar-integration, etc.
  severity TEXT,  -- critical, high, medium, low
  tags TEXT[],    -- Array of tags
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CHECK (category IN ('context-management', 'github-automation', 'bmad-workflow', 'scar-integration', 'template-issues', 'git-operations', 'tool-usage', 'project-setup')),
  CHECK (severity IN ('critical', 'high', 'medium', 'low'))
);

CREATE INDEX idx_knowledge_category ON knowledge_chunks(category);
CREATE INDEX idx_knowledge_severity ON knowledge_chunks(severity);
CREATE INDEX idx_knowledge_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_text_fts ON knowledge_chunks USING gin(to_tsvector('english', chunk_text));

-- ============================================================================
-- INSTRUCTION MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS instruction_updates (
  id SERIAL PRIMARY KEY,
  update_id TEXT NOT NULL UNIQUE,
  layer TEXT NOT NULL,  -- core, meta, project-specific
  file_path TEXT NOT NULL,  -- .supervisor-core/core-behaviors.md
  change_description TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by TEXT,  -- meta-supervisor or user

  -- Propagation tracking
  propagated_to TEXT[],  -- Array of projects that received this update
  propagation_status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed

  -- Constraints
  CHECK (layer IN ('core', 'meta', 'project-specific')),
  CHECK (propagation_status IN ('pending', 'in_progress', 'completed'))
);

CREATE INDEX idx_instruction_updates_layer ON instruction_updates(layer);
CREATE INDEX idx_instruction_updates_status ON instruction_updates(propagation_status);
CREATE INDEX idx_instruction_updates_time ON instruction_updates(updated_at);

-- ============================================================================
-- CLOUDFLARE INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS cloudflare_dns_records (
  id SERIAL PRIMARY KEY,
  record_id TEXT NOT NULL UNIQUE,  -- Cloudflare record ID
  zone_id TEXT NOT NULL,
  record_type TEXT NOT NULL,  -- A, CNAME, TXT, etc.
  name TEXT NOT NULL,  -- service.153.se
  content TEXT NOT NULL,  -- IP or target
  proxied BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  managed_by TEXT,  -- project name that owns this record

  -- Constraints
  CHECK (record_type IN ('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV'))
);

CREATE INDEX idx_cloudflare_zone ON cloudflare_dns_records(zone_id);
CREATE INDEX idx_cloudflare_name ON cloudflare_dns_records(name);
CREATE INDEX idx_cloudflare_managed_by ON cloudflare_dns_records(managed_by);

CREATE TABLE IF NOT EXISTS cloudflare_tunnel_routes (
  id SERIAL PRIMARY KEY,
  tunnel_id TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,  -- service.153.se
  service TEXT NOT NULL,  -- http://localhost:3100
  port INTEGER NOT NULL,
  project_name TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tunnel_routes_tunnel ON cloudflare_tunnel_routes(tunnel_id);
CREATE INDEX idx_tunnel_routes_project ON cloudflare_tunnel_routes(project_name);

-- ============================================================================
-- GCLOUD INTEGRATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS gcloud_vms (
  id SERIAL PRIMARY KEY,
  vm_id TEXT NOT NULL UNIQUE,  -- instance ID from GCloud
  project_id TEXT NOT NULL,  -- GCloud project ID
  zone TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  machine_type TEXT NOT NULL,
  status TEXT NOT NULL,  -- RUNNING, STOPPED, TERMINATED
  internal_ip TEXT,
  external_ip TEXT,
  managed_by TEXT,  -- meta or project name
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_health_check TIMESTAMP,

  -- Constraints
  CHECK (status IN ('RUNNING', 'STOPPED', 'TERMINATED', 'PROVISIONING'))
);

CREATE INDEX idx_gcloud_vms_project ON gcloud_vms(project_id);
CREATE INDEX idx_gcloud_vms_status ON gcloud_vms(status);
CREATE INDEX idx_gcloud_vms_managed_by ON gcloud_vms(managed_by);

CREATE TABLE IF NOT EXISTS gcloud_health_metrics (
  id SERIAL PRIMARY KEY,
  vm_id TEXT NOT NULL REFERENCES gcloud_vms(vm_id),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  cpu_usage NUMERIC,  -- 0-100%
  memory_usage NUMERIC,  -- 0-100%
  disk_usage NUMERIC,  -- 0-100%
  network_in_bytes BIGINT,
  network_out_bytes BIGINT
);

CREATE INDEX idx_health_metrics_vm ON gcloud_health_metrics(vm_id);
CREATE INDEX idx_health_metrics_time ON gcloud_health_metrics(timestamp);

-- ============================================================================
-- AUTOMATIC SECRET DETECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS secret_detection_patterns (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,  -- anthropic, openai, stripe, etc.
  pattern TEXT NOT NULL,  -- Regex pattern
  secret_type TEXT NOT NULL,  -- api_key, token, password
  key_path_template TEXT NOT NULL,  -- meta/{provider}/api_key
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Insert default patterns
INSERT INTO secret_detection_patterns (provider, pattern, secret_type, key_path_template) VALUES
  ('anthropic', '^sk-ant-[a-zA-Z0-9-_]{95,}$', 'api_key', 'meta/anthropic/api_key'),
  ('openai', '^sk-[a-zA-Z0-9]{48}$', 'api_key', 'meta/openai/api_key'),
  ('stripe_live', '^sk_live_[a-zA-Z0-9]{24,}$', 'api_key', 'project/{project}/stripe_live_key'),
  ('stripe_test', '^sk_test_[a-zA-Z0-9]{24,}$', 'api_key', 'project/{project}/stripe_test_key'),
  ('github', '^ghp_[a-zA-Z0-9]{36}$', 'token', 'meta/github/personal_access_token'),
  ('cloudflare', '^[a-zA-Z0-9]{40}$', 'token', 'meta/cloudflare/api_token'),
  ('google_api', '^AIza[a-zA-Z0-9_-]{35}$', 'api_key', 'meta/google/api_key')
ON CONFLICT (provider) DO NOTHING;

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Available ports per project
CREATE OR REPLACE VIEW available_ports AS
SELECT
  pr.project_id,
  pr.project_name,
  pr.port_range_start + gs AS port
FROM
  project_port_ranges pr
CROSS JOIN
  generate_series(0, 99) AS gs
WHERE
  NOT EXISTS (
    SELECT 1 FROM port_allocations pa
    WHERE pa.port = pr.port_range_start + gs
    AND pa.status = 'active'
  );

-- View: Task execution statistics
CREATE OR REPLACE VIEW task_execution_stats AS
SELECT
  task_type,
  project_name,
  COUNT(*) AS total_executions,
  AVG(duration_seconds) AS avg_duration,
  STDDEV(duration_seconds) AS stddev_duration,
  AVG(estimation_error) AS avg_estimation_error,
  MIN(duration_seconds) AS min_duration,
  MAX(duration_seconds) AS max_duration,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) AS success_rate
FROM
  task_executions
WHERE
  status = 'completed'
GROUP BY
  task_type, project_name;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Meta supervisor port range (3000-3099)
INSERT INTO project_port_ranges (project_id, project_name, port_range_start, port_range_end)
VALUES (0, 'meta', 3000, 3099)
ON CONFLICT (project_id) DO NOTHING;

-- Shared services port range (9000-9099) - first 100 of shared range
INSERT INTO project_port_ranges (project_id, project_name, port_range_start, port_range_end)
VALUES (999, 'shared-services', 9000, 9099)
ON CONFLICT (project_id) DO NOTHING;

-- Allocate port 3000 for meta supervisor MCP server
INSERT INTO port_allocations (project_id, port, service_name, description, allocated_by, status)
VALUES (0, 3000, 'meta-mcp-server', 'Meta supervisor MCP server', 'system', 'active')
ON CONFLICT (port) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Get next available project ID
CREATE OR REPLACE FUNCTION get_next_project_id()
RETURNS INTEGER AS $$
DECLARE
  next_id INTEGER;
BEGIN
  SELECT COALESCE(MAX(project_id), 0) + 1 INTO next_id
  FROM project_port_ranges
  WHERE project_id < 999;  -- Exclude shared services
  RETURN next_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Allocate next available port for project
CREATE OR REPLACE FUNCTION allocate_next_port(
  p_project_id INTEGER,
  p_service_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_cloudflare_hostname TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  allocated_port INTEGER;
BEGIN
  -- Get first available port from view
  SELECT port INTO allocated_port
  FROM available_ports
  WHERE project_id = p_project_id
  LIMIT 1;

  IF allocated_port IS NULL THEN
    RAISE EXCEPTION 'No available ports for project %', p_project_id;
  END IF;

  -- Allocate the port
  INSERT INTO port_allocations (project_id, port, service_name, description, cloudflare_hostname, allocated_by, status)
  VALUES (p_project_id, allocated_port, p_service_name, p_description, p_cloudflare_hostname, 'system', 'active');

  RETURN allocated_port;
END;
$$ LANGUAGE plpgsql;

-- Function: Update task execution duration
CREATE OR REPLACE FUNCTION complete_task_execution(
  p_task_id TEXT,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE task_executions
  SET
    completed_at = NOW(),
    duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
    estimation_error = CASE
      WHEN estimated_seconds > 0 THEN
        (EXTRACT(EPOCH FROM (NOW() - started_at)) - estimated_seconds)::NUMERIC / estimated_seconds
      ELSE NULL
    END,
    status = p_status,
    error_message = p_error_message
  WHERE task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (assuming supervisor_user exists)
-- ============================================================================

-- These will run after user is created
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supervisor_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supervisor_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO supervisor_user;
