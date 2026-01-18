#!/usr/bin/env node

/**
 * SSE-based MCP Server for Claude.ai Browser Connections
 *
 * Provides HTTP/SSE access to supervisor-service MCP tools.
 * Supports project-scoped access for multi-project isolation.
 *
 * Usage:
 *   - Meta project: Full access to all tools (supermcp.153.se/sse?project=meta)
 *   - Other projects: Scoped access (supermcp.153.se/sse?project=consilio)
 *
 * Architecture:
 *   - Express server on port 8082
 *   - SSE transport for MCP protocol
 *   - Project-scoping middleware filters tools/data by project
 *   - Behind Cloudflare tunnel (supermcp.153.se)
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SecretsManager } from '../secrets/SecretsManager.js';
import { PortManager } from '../ports/PortManager.js';
import { TaskTimer } from '../timing/TaskTimer.js';

const app = express();
const PORT = 8082;

// Initialize managers (shared across all connections)
const encryptionKey = process.env.ENCRYPTION_KEY || '';
if (!encryptionKey || encryptionKey.length !== 64) {
  console.error('ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)');
  process.exit(1);
}

const secretsManager = new SecretsManager(encryptionKey);
const portManager = new PortManager();
const taskTimer = new TaskTimer();

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

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'supervisor-service-mcp-sse',
    version: '1.0.0',
    transport: 'sse',
  });
});

/**
 * Create project-scoped tool list
 *
 * - meta project: Full access to all tools
 * - Other projects: Only their own secrets/ports
 */
function createToolsForProject(projectName: string): Tool[] {
  const isMetaProject = projectName === 'meta';

  const tools: Tool[] = [
    // ==================== SECRETS ====================
    {
      name: 'mcp__meta__store_secret',
      description: isMetaProject
        ? 'Store an encrypted secret (API key, token, password, etc.)'
        : `Store an encrypted secret for project ${projectName}`,
      inputSchema: {
        type: 'object',
        properties: {
          keyPath: {
            type: 'string',
            description: isMetaProject
              ? 'Hierarchical key path (e.g., meta/anthropic/api_key, project/consilio/stripe_key)'
              : `Key path within project/${projectName}/ (e.g., project/${projectName}/stripe_key)`,
          },
          value: {
            type: 'string',
            description: 'Secret value to encrypt and store',
          },
          description: {
            type: 'string',
            description: 'Optional description of what this secret is for',
          },
          secretType: {
            type: 'string',
            description: 'Type of secret: api_key, token, password, certificate, etc.',
          },
          provider: {
            type: 'string',
            description: 'Provider name: anthropic, openai, cloudflare, gcloud, stripe, etc.',
          },
        },
        required: ['keyPath', 'value'],
      },
    },
    {
      name: 'mcp__meta__retrieve_secret',
      description: isMetaProject
        ? 'Retrieve and decrypt a secret by key path'
        : `Retrieve and decrypt a secret for project ${projectName}`,
      inputSchema: {
        type: 'object',
        properties: {
          keyPath: {
            type: 'string',
            description: 'Hierarchical key path of the secret to retrieve',
          },
        },
        required: ['keyPath'],
      },
    },
    {
      name: 'mcp__meta__list_secrets',
      description: isMetaProject
        ? 'List all secrets (metadata only, no values)'
        : `List secrets for project ${projectName} (metadata only, no values)`,
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            description: 'Optional: filter by provider name',
          },
          secretType: {
            type: 'string',
            description: 'Optional: filter by secret type',
          },
        },
      },
    },

    // ==================== PORTS ====================
    {
      name: 'mcp__meta__allocate_port',
      description: isMetaProject
        ? 'Allocate next available port for a project service'
        : `Allocate next available port for ${projectName} service`,
      inputSchema: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: isMetaProject
              ? 'Project name to allocate port for'
              : `Project name (must be ${projectName})`,
          },
          serviceName: {
            type: 'string',
            description: 'Service name (e.g., penpot, storybook, api-server)',
          },
          description: {
            type: 'string',
            description: 'Optional description of the service',
          },
          cloudflareHostname: {
            type: 'string',
            description: 'Optional Cloudflare hostname (e.g., service.153.se)',
          },
        },
        required: ['projectName', 'serviceName'],
      },
    },
    {
      name: 'mcp__meta__list_ports',
      description: isMetaProject
        ? 'List port allocations for a project or all projects'
        : `List port allocations for ${projectName}`,
      inputSchema: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'Optional: filter by project name',
          },
          includeReleased: {
            type: 'boolean',
            description: 'Include released ports (default: false)',
          },
        },
      },
    },
    {
      name: 'mcp__meta__get_port_utilization',
      description: isMetaProject
        ? 'Get port utilization statistics for a project'
        : `Get port utilization statistics for ${projectName}`,
      inputSchema: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'Project name to get utilization for',
          },
        },
        required: ['projectName'],
      },
    },
    {
      name: 'mcp__meta__release_port',
      description: 'Release a port allocation (mark as released)',
      inputSchema: {
        type: 'object',
        properties: {
          port: {
            type: 'number',
            description: 'Port number to release',
          },
        },
        required: ['port'],
      },
    },

    // ==================== TASKS ====================
    {
      name: 'mcp__meta__start_task',
      description: 'Start timing a task execution',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Unique task ID',
          },
          taskType: {
            type: 'string',
            description: 'Task type (e.g., file_search, epic_creation, code_generation)',
          },
          taskDescription: {
            type: 'string',
            description: 'Brief description of the task',
          },
          estimatedSeconds: {
            type: 'number',
            description: 'Estimated duration in seconds',
          },
          projectName: {
            type: 'string',
            description: 'Project name this task belongs to',
          },
          complexity: {
            type: 'string',
            enum: ['simple', 'moderate', 'complex'],
            description: 'Task complexity level',
          },
        },
        required: ['taskId', 'taskType', 'taskDescription'],
      },
    },
    {
      name: 'mcp__meta__complete_task',
      description: 'Mark a task as completed',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'Task ID to complete',
          },
          filesChanged: {
            type: 'number',
            description: 'Number of files changed',
          },
          linesChanged: {
            type: 'number',
            description: 'Number of lines changed',
          },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'mcp__meta__get_task_stats',
      description: 'Get execution statistics for task types',
      inputSchema: {
        type: 'object',
        properties: {
          taskType: {
            type: 'string',
            description: 'Optional: filter by task type',
          },
          projectName: {
            type: 'string',
            description: 'Optional: filter by project name',
          },
        },
      },
    },
  ];

  return tools;
}

/**
 * Project-scoping middleware for tool handlers
 * Filters data based on project context
 */
function applyScopeFilter(projectName: string, args: any, toolName: string): any {
  const isMetaProject = projectName === 'meta';

  // Meta project has full access
  if (isMetaProject) {
    return args;
  }

  // For other projects, enforce scoping
  if (toolName === 'mcp__meta__store_secret' || toolName === 'mcp__meta__retrieve_secret') {
    // Ensure keyPath starts with project/{projectName}/
    if (args.keyPath && !args.keyPath.startsWith(`project/${projectName}/`)) {
      throw new Error(
        `Access denied: Project ${projectName} can only access secrets under project/${projectName}/`
      );
    }
  }

  if (toolName === 'mcp__meta__allocate_port') {
    // Ensure projectName matches
    if (args.projectName && args.projectName !== projectName) {
      throw new Error(
        `Access denied: Project ${projectName} can only allocate ports for itself`
      );
    }
    // Auto-set projectName if not provided
    args.projectName = projectName;
  }

  if (toolName === 'mcp__meta__list_ports' || toolName === 'mcp__meta__get_port_utilization') {
    // Force projectName to current project
    args.projectName = projectName;
  }

  if (toolName === 'mcp__meta__start_task' || toolName === 'mcp__meta__get_task_stats') {
    // Auto-set projectName if not provided
    if (!args.projectName) {
      args.projectName = projectName;
    }
  }

  return args;
}

/**
 * Filter response data based on project scope
 */
function filterResponseData(projectName: string, data: any, toolName: string): any {
  const isMetaProject = projectName === 'meta';

  // Meta project sees everything
  if (isMetaProject) {
    return data;
  }

  // For other projects, filter results
  if (toolName === 'mcp__meta__list_secrets' && data.secrets) {
    // Only show secrets for this project
    data.secrets = data.secrets.filter((s: any) =>
      s.keyPath.startsWith(`project/${projectName}/`)
    );
    data.count = data.secrets.length;
  }

  if (toolName === 'mcp__meta__list_ports' && data.allocations) {
    // Only show ports for this project
    data.allocations = data.allocations.filter((a: any) => a.projectName === projectName);
    data.count = data.allocations.length;
  }

  return data;
}

/**
 * SSE endpoint with project scoping
 *
 * Query parameter: ?project=consilio (default: meta)
 */
app.get('/sse', async (req, res) => {
  const projectName = (req.query.project as string) || 'meta';
  console.error(`New SSE connection for project: ${projectName}`);

  // Create MCP server instance
  const server = new Server(
    {
      name: `supervisor-service-${projectName}`,
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Get project-scoped tools
  const tools = createToolsForProject(projectName);

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      // Apply project scoping to arguments
      const scopedArgs = applyScopeFilter(projectName, args, name);

      let result: any;

      switch (name) {
        // ==================== SECRETS ====================
        case 'mcp__meta__store_secret': {
          const secret = await secretsManager.store(
            scopedArgs.keyPath as string,
            scopedArgs.value as string,
            {
              description: scopedArgs.description as string | undefined,
              secretType: scopedArgs.secretType as string | undefined,
              provider: scopedArgs.provider as string | undefined,
            }
          );
          result = {
            success: true,
            keyPath: secret.keyPath,
            createdAt: secret.createdAt,
            message: 'Secret stored successfully',
          };
          break;
        }

        case 'mcp__meta__retrieve_secret': {
          const value = await secretsManager.retrieve(scopedArgs.keyPath as string);
          if (value === null) {
            result = {
              success: false,
              error: `Secret not found: ${scopedArgs.keyPath}`,
            };
          } else {
            result = {
              success: true,
              keyPath: scopedArgs.keyPath,
              value,
            };
          }
          break;
        }

        case 'mcp__meta__list_secrets': {
          const secrets = await secretsManager.list({
            provider: scopedArgs.provider as string | undefined,
            secretType: scopedArgs.secretType as string | undefined,
          });
          result = {
            success: true,
            count: secrets.length,
            secrets: secrets.map((s) => ({
              keyPath: s.keyPath,
              description: s.description,
              secretType: s.secretType,
              provider: s.provider,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
            })),
          };
          // Apply project filtering
          result = filterResponseData(projectName, result, name);
          break;
        }

        // ==================== PORTS ====================
        case 'mcp__meta__allocate_port': {
          // Ensure project has a port range
          let portRange = await portManager.getPortRange(scopedArgs.projectName as string);
          if (!portRange) {
            portRange = await portManager.createPortRange(scopedArgs.projectName as string);
          }

          const allocation = await portManager.allocatePort(
            scopedArgs.projectName as string,
            scopedArgs.serviceName as string,
            {
              description: scopedArgs.description as string | undefined,
              cloudflareHostname: scopedArgs.cloudflareHostname as string | undefined,
            }
          );
          result = {
            success: true,
            port: allocation.port,
            serviceName: allocation.serviceName,
            projectName: scopedArgs.projectName,
            allocatedAt: allocation.allocatedAt,
          };
          break;
        }

        case 'mcp__meta__list_ports': {
          const allocations = await portManager.listAllocations(
            scopedArgs.projectName as string | undefined,
            scopedArgs.includeReleased as boolean | undefined
          );
          result = {
            success: true,
            count: allocations.length,
            allocations,
          };
          // Apply project filtering
          result = filterResponseData(projectName, result, name);
          break;
        }

        case 'mcp__meta__get_port_utilization': {
          const utilization = await portManager.getUtilization(scopedArgs.projectName as string);
          result = {
            success: true,
            projectName: scopedArgs.projectName,
            utilization,
          };
          break;
        }

        case 'mcp__meta__release_port': {
          const released = await portManager.releasePort(scopedArgs.port as number);
          result = {
            success: released,
            port: scopedArgs.port,
            message: released
              ? 'Port released successfully'
              : 'Port not found or already released',
          };
          break;
        }

        // ==================== TASKS ====================
        case 'mcp__meta__start_task': {
          const task = await taskTimer.startTask(
            scopedArgs.taskId as string,
            scopedArgs.taskType as string,
            scopedArgs.taskDescription as string,
            {
              estimatedSeconds: scopedArgs.estimatedSeconds as number | undefined,
              projectName: scopedArgs.projectName as string | undefined,
              complexity: scopedArgs.complexity as 'simple' | 'moderate' | 'complex' | undefined,
            }
          );
          result = {
            success: true,
            taskId: task.taskId,
            startedAt: task.startedAt,
          };
          break;
        }

        case 'mcp__meta__complete_task': {
          const task = await taskTimer.completeTask(scopedArgs.taskId as string, {
            filesChanged: scopedArgs.filesChanged as number | undefined,
            linesChanged: scopedArgs.linesChanged as number | undefined,
          });
          result = {
            success: true,
            taskId: scopedArgs.taskId,
            durationSeconds: task?.durationSeconds,
            status: task?.status,
          };
          break;
        }

        case 'mcp__meta__get_task_stats': {
          const stats = await taskTimer.getStats({
            taskType: scopedArgs.taskType as string | undefined,
            projectName: scopedArgs.projectName as string | undefined,
          });
          result = {
            success: true,
            stats,
          };
          break;
        }

        default:
          result = {
            success: false,
            error: `Unknown tool: ${name}`,
          };
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: true,
          };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Create SSE transport
  const transport = new SSEServerTransport('/message', res);
  await server.connect(transport);

  console.error(`SSE connection established for project: ${projectName}`);

  // Handle client disconnect
  req.on('close', async () => {
    console.error(`SSE connection closed for project: ${projectName}`);
  });
});

// Message endpoint for POST requests (SSE transport requirement)
app.post('/message', async (_req, res) => {
  // SSE transport handles this automatically
  res.json({ status: 'received' });
});

// Start server
app.listen(PORT, () => {
  console.error(`MCP SSE Server running on port ${PORT}`);
  console.error(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`Public URL: https://supermcp.153.se/sse`);
  console.error('');
  console.error('Connect from Claude.ai Projects with:');
  console.error('  Meta project: https://supermcp.153.se/sse?project=meta');
  console.error('  Consilio: https://supermcp.153.se/sse?project=consilio');
  console.error('  Health-Agent: https://supermcp.153.se/sse?project=health-agent');
  console.error('  Odin: https://supermcp.153.se/sse?project=odin');
});
