#!/bin/bash
# Database migration script

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  echo "Please create .env file with DATABASE_URL"
  exit 1
fi

echo "Running database migrations..."

# Run each migration in order
for migration in migrations/*.sql; do
  echo "Applying: $migration"
  psql "$DATABASE_URL" -f "$migration"
done

echo "Migrations complete!"
