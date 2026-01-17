-- Migration: Create verification_results table
-- Description: Historical record of SCAR implementation verifications

CREATE TABLE IF NOT EXISTS verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(255) NOT NULL,
  issue_number INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL,
  build_success BOOLEAN,
  tests_passed BOOLEAN,
  mocks_detected BOOLEAN,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('passed', 'failed', 'partial', 'error')),
  CONSTRAINT valid_issue_number CHECK (issue_number > 0)
);

CREATE INDEX idx_verifications_project_issue ON verification_results(project_name, issue_number);
CREATE INDEX idx_verifications_status ON verification_results(status, created_at);
CREATE INDEX idx_verifications_created_at ON verification_results(created_at DESC);

COMMENT ON TABLE verification_results IS 'Historical verification results for SCAR implementations';
COMMENT ON COLUMN verification_results.status IS 'Overall verification status';
COMMENT ON COLUMN verification_results.build_success IS 'Whether build completed successfully';
COMMENT ON COLUMN verification_results.tests_passed IS 'Whether tests passed';
COMMENT ON COLUMN verification_results.mocks_detected IS 'Whether mock/placeholder code was found';
COMMENT ON COLUMN verification_results.details IS 'Detailed results (error messages, file paths, etc.)';
