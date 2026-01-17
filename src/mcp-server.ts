#!/usr/bin/env node

/**
 * Standalone MCP Server Entry Point
 * 
 * This file creates a standalone MCP server that can be used
 * with Claude.ai Projects via stdio transport.
 * 
 * Usage:
 *   node dist/mcp-server.js
 */

import { SupervisorMCPServer } from './mcp/server';
import { config } from './config';

async function main() {
  console.error('Starting Supervisor MCP Server...');
  
  // Validate configuration
  if (!config.github.token) {
    console.error('ERROR: GITHUB_TOKEN not configured');
    process.exit(1);
  }
  
  if (!config.database.host) {
    console.error('ERROR: Database configuration missing');
    process.exit(1);
  }
  
  // Create and start server
  const server = new SupervisorMCPServer();
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down...');
    await server.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down...');
    await server.shutdown();
    process.exit(0);
  });
  
  // Start server
  await server.start();
  
  console.error('MCP Server ready');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
