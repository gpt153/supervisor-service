#!/usr/bin/env node

/**
 * MCP Server with SSE Transport
 *
 * Provides HTTP/SSE access to the MCP server for Claude.ai Projects
 * to connect remotely via supermcp.153.se
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { config } from './config';

// Import tool modules
import { registerPlanningTools } from './mcp/tools/planning';
import { registerGitTools } from './mcp/tools/git';
import { registerGitHubTools } from './mcp/tools/github';
import { registerScarTools } from './mcp/tools/scar';
import { registerVerificationTools } from './mcp/tools/verification';
import { registerKnowledgeTools } from './mcp/tools/knowledge';

const app = express();
const PORT = 8082;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'supervisor-mcp-sse',
    version: '1.0.0',
    transport: 'sse'
  });
});

// SSE endpoint for MCP
app.get('/sse', async (_req, res) => {
  console.error('New SSE connection');

  // Create MCP server instance
  const server = new Server(
    {
      name: 'supervisor-service',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Database pool
  const pool = new Pool({
    connectionString: config.database.url,
  });

  const tools: Map<string, Tool> = new Map();
  const toolHandlers: Map<string, Function> = new Map();

  // Register all tools
  const registerToolFn = (tool: Tool, handler: Function) => {
    tools.set(tool.name, tool);
    toolHandlers.set(tool.name, handler);
  };

  const context = {
    pool,
    registerTool: registerToolFn,
  };

  // Register tool categories
  registerPlanningTools(context);
  registerGitTools(context);
  registerGitHubTools(context);
  registerScarTools(context);
  registerVerificationTools(context);
  registerKnowledgeTools(context);

  console.error(`Registered ${tools.size} tools`);

  // Setup handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Array.from(tools.values()),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const handler = toolHandlers.get(toolName);

    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    try {
      const result = await handler(request.params.arguments || {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Create SSE transport
  const transport = new SSEServerTransport('/message', res);
  await server.connect(transport);

  console.error('SSE connection established');

  // Handle client disconnect
  _req.on('close', async () => {
    console.error('SSE connection closed');
    await pool.end();
  });
});

// Message endpoint for POST requests
app.post('/message', async (_req, res) => {
  // This would handle incoming messages from the client
  // The SSE transport handles this automatically
  res.json({ status: 'received' });
});

// Start server
app.listen(PORT, () => {
  console.error(`MCP SSE Server running on port ${PORT}`);
  console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`Public URL: https://supermcp.153.se/sse`);
  console.error('');
  console.error('Connect from Claude.ai Projects with:');
  console.error('  URL: https://supermcp.153.se/sse');
  console.error('  Transport: SSE');
});
