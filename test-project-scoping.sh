#!/bin/bash

# Test script for project scoping in MCP server
# This verifies that different PROJECT_NAME values correctly filter data

set -e

echo "======================================"
echo "Testing MCP Server Project Scoping"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test database connection
echo -e "${YELLOW}Testing database connection...${NC}"
if psql -h /var/run/postgresql -p 5434 -U supervisor_user -d supervisor -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    echo "Make sure PostgreSQL is running on port 5434"
    exit 1
fi
echo ""

# Insert test data (if needed)
echo -e "${YELLOW}Setting up test data...${NC}"

# Insert test secrets for different projects
psql -h /var/run/postgresql -p 5434 -U supervisor_user -d supervisor <<EOF > /dev/null 2>&1
-- Insert test secrets (using dummy encrypted values - just for testing filters)
INSERT INTO secrets (key_path, encrypted_value, description, secret_type, provider)
VALUES
  ('meta/test/api_key', 'encrypted_meta_value', 'Meta test secret', 'api_key', 'test'),
  ('project/consilio/stripe_key', 'encrypted_consilio_stripe', 'Consilio Stripe key', 'api_key', 'stripe'),
  ('project/consilio/db_password', 'encrypted_consilio_db', 'Consilio DB password', 'password', 'postgresql'),
  ('project/openhorizon/aws_key', 'encrypted_oh_aws', 'OpenHorizon AWS key', 'api_key', 'aws'),
  ('project/openhorizon/api_token', 'encrypted_oh_api', 'OpenHorizon API token', 'token', 'custom')
ON CONFLICT (key_path) DO NOTHING;
EOF

echo -e "${GREEN}✓ Test data ready${NC}"
echo ""

# Test 1: Meta project should see all secrets
echo -e "${YELLOW}Test 1: Meta project (full access)${NC}"
echo "Starting MCP server with PROJECT_NAME=meta..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mcp__meta__list_secrets","arguments":{}}}' | \
  PROJECT_NAME=meta \
  DB_HOST=/var/run/postgresql \
  DB_PORT=5434 \
  DB_NAME=supervisor \
  DB_USER=supervisor_user \
  ENCRYPTION_KEY="${ENCRYPTION_KEY:-ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f}" \
  node dist/mcp/server.js 2>&1 | grep -q '"count"' && \
  echo -e "${GREEN}✓ Meta project can access secrets${NC}" || \
  echo -e "${RED}✗ Meta project failed${NC}"
echo ""

# Test 2: Consilio project should only see consilio + meta secrets
echo -e "${YELLOW}Test 2: Consilio project (scoped access)${NC}"
echo "Starting MCP server with PROJECT_NAME=consilio..."
RESULT=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mcp__meta__list_secrets","arguments":{}}}' | \
  PROJECT_NAME=consilio \
  DB_HOST=/var/run/postgresql \
  DB_PORT=5434 \
  DB_NAME=supervisor \
  DB_USER=supervisor_user \
  ENCRYPTION_KEY="${ENCRYPTION_KEY:-ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f}" \
  node dist/mcp/server.js 2>&1)

# Check that result contains consilio scope
if echo "$RESULT" | grep -q '"projectScope":"consilio"'; then
    echo -e "${GREEN}✓ Consilio project shows correct scope${NC}"
else
    echo -e "${RED}✗ Consilio project scope incorrect${NC}"
fi

# Check that result doesn't contain openhorizon secrets
if echo "$RESULT" | grep -q 'openhorizon'; then
    echo -e "${RED}✗ Consilio can see OpenHorizon secrets (SECURITY ISSUE!)${NC}"
else
    echo -e "${GREEN}✓ Consilio cannot see OpenHorizon secrets${NC}"
fi
echo ""

# Test 3: Consilio trying to access OpenHorizon secret should fail
echo -e "${YELLOW}Test 3: Access control test${NC}"
echo "Consilio trying to retrieve OpenHorizon secret..."
RESULT=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mcp__meta__retrieve_secret","arguments":{"keyPath":"project/openhorizon/aws_key"}}}' | \
  PROJECT_NAME=consilio \
  DB_HOST=/var/run/postgresql \
  DB_PORT=5434 \
  DB_NAME=supervisor \
  DB_USER=supervisor_user \
  ENCRYPTION_KEY="${ENCRYPTION_KEY:-ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f}" \
  node dist/mcp/server.js 2>&1)

if echo "$RESULT" | grep -q '"success":false' && echo "$RESULT" | grep -q 'Access denied'; then
    echo -e "${GREEN}✓ Access denied correctly${NC}"
else
    echo -e "${RED}✗ Access control failed (SECURITY ISSUE!)${NC}"
fi
echo ""

# Test 4: Consilio can access meta secrets
echo -e "${YELLOW}Test 4: Meta secret access test${NC}"
echo "Consilio trying to retrieve meta secret..."
RESULT=$(echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mcp__meta__retrieve_secret","arguments":{"keyPath":"meta/test/api_key"}}}' | \
  PROJECT_NAME=consilio \
  DB_HOST=/var/run/postgresql \
  DB_PORT=5434 \
  DB_NAME=supervisor \
  DB_USER=supervisor_user \
  ENCRYPTION_KEY="${ENCRYPTION_KEY:-ead0721a1b7c254b762ceb0a139c0104281c836a75d16d750788751dbf411f4f}" \
  node dist/mcp/server.js 2>&1)

if echo "$RESULT" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Consilio can access meta secrets${NC}"
else
    echo -e "${RED}✗ Meta secret access failed${NC}"
fi
echo ""

echo "======================================"
echo -e "${GREEN}Project scoping tests complete!${NC}"
echo "======================================"
