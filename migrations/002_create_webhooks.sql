-- Migration: Create webhook_events table
-- Description: Queue for async processing of GitHub webhook events

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  project_name VARCHAR(255),
  issue_number INTEGER,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  error_message TEXT,
  CONSTRAINT valid_issue_number CHECK (issue_number > 0)
);

CREATE INDEX idx_webhooks_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_webhooks_project_issue ON webhook_events(project_name, issue_number);
CREATE INDEX idx_webhooks_event_type ON webhook_events(event_type);

COMMENT ON TABLE webhook_events IS 'GitHub webhook event queue for async processing';
COMMENT ON COLUMN webhook_events.event_type IS 'GitHub event type (issue_comment, issues, etc.)';
COMMENT ON COLUMN webhook_events.project_name IS 'Identified project from repository name';
COMMENT ON COLUMN webhook_events.payload IS 'Full GitHub webhook payload';
COMMENT ON COLUMN webhook_events.processed IS 'Whether event has been processed';
