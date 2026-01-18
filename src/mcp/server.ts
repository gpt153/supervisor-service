import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SecretsManager } from '../secrets/SecretsManager.js';
import { PortManager } from '../ports/PortManager.js';
import { TaskTimer } from '../timing/TaskTimer.js';
// CloudflareManager and GCloudManager reserved for future use
// import { CloudflareManager } from '../cloudflare/CloudflareManager.js';
// import { GCloudManager } from '../gcloud/GCloudManager.js';

// Initialize managers
const encryptionKey = process.env.ENCRYPTION_KEY || '';
if (!encryptionKey || encryptionKey.length !== 64) {
  console.error('ENCRYPTION_KEY must be set and be 64 hex characters (32 bytes)');
  process.exit(1);
}

// Project scoping - defaults to 'meta' for full access
const projectName = process.env.PROJECT_NAME || 'meta';
console.error(`MCP Server initialized for project: ${projectName}`);

const secretsManager = new SecretsManager(encryptionKey);
const portManager = new PortManager();
const taskTimer = new TaskTimer();
// CloudflareManager and GCloudManager reserved for future use
// const cloudflareManager = new CloudflareManager();
// const gcloudManager = new GCloudManager();

// Define MCP tools
const tools: Tool[] = [
  // ==================== SECRETS ====================
  {
    name: 'mcp__meta__store_secret',
    description: 'Store an encrypted secret (API key, token, password, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        keyPath: {
          type: 'string',
          description: 'Hierarchical key path (e.g., meta/anthropic/api_key, project/consilio/stripe_key)',
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
    description: `Retrieve and decrypt a secret by key path (project-scoped for "${projectName}")`,
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
    description: `List all secrets accessible to project "${projectName}" (metadata only, no values)`,
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
    description: 'Allocate next available port for a project service',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Project name to allocate port for',
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
    description: `List port allocations for project "${projectName}"`,
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
    description: 'Get port utilization statistics for a project',
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
    description: `Get execution statistics for project "${projectName}"`,
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

// Create MCP server
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

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      // ==================== SECRETS ====================
      case 'mcp__meta__store_secret': {
        const secret = await secretsManager.store(
          args.keyPath as string,
          args.value as string,
          {
            description: args.description as string | undefined,
            secretType: args.secretType as string | undefined,
            provider: args.provider as string | undefined,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                keyPath: secret.keyPath,
                createdAt: secret.createdAt,
                message: 'Secret stored successfully',
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__retrieve_secret': {
        const keyPath = args.keyPath as string;

        // Project scoping: Only allow access to project's secrets and meta secrets
        if (projectName !== 'meta') {
          const allowedPrefixes = [`project/${projectName}/`, 'meta/'];
          const isAllowed = allowedPrefixes.some(prefix => keyPath.startsWith(prefix));

          if (!isAllowed) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Access denied: Project "${projectName}" can only access secrets with keyPath starting with "project/${projectName}/" or "meta/"`,
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }

        const value = await secretsManager.retrieve(keyPath);
        if (value === null) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: `Secret not found: ${keyPath}`,
                }, null, 2),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                keyPath: keyPath,
                value,
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__list_secrets': {
        let secrets = await secretsManager.list({
          provider: args.provider as string | undefined,
          secretType: args.secretType as string | undefined,
        });

        // Project scoping: Filter secrets by keyPath prefix
        if (projectName !== 'meta') {
          secrets = secrets.filter(s =>
            s.keyPath.startsWith(`project/${projectName}/`) ||
            s.keyPath.startsWith('meta/')
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: secrets.length,
                projectScope: projectName,
                secrets: secrets.map((s) => ({
                  keyPath: s.keyPath,
                  description: s.description,
                  secretType: s.secretType,
                  provider: s.provider,
                  createdAt: s.createdAt,
                  updatedAt: s.updatedAt,
                })),
              }, null, 2),
            },
          ],
        };
      }

      // ==================== PORTS ====================
      case 'mcp__meta__allocate_port': {
        // Ensure project has a port range
        let portRange = await portManager.getPortRange(args.projectName as string);
        if (!portRange) {
          portRange = await portManager.createPortRange(args.projectName as string);
        }

        const allocation = await portManager.allocatePort(
          args.projectName as string,
          args.serviceName as string,
          {
            description: args.description as string | undefined,
            cloudflareHostname: args.cloudflareHostname as string | undefined,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                port: allocation.port,
                serviceName: allocation.serviceName,
                projectName: args.projectName,
                allocatedAt: allocation.allocatedAt,
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__list_ports': {
        // Project scoping: Override projectName filter if not meta
        const filterProjectName = projectName === 'meta'
          ? (args.projectName as string | undefined)
          : projectName;

        const allocations = await portManager.listAllocations(
          filterProjectName,
          args.includeReleased as boolean | undefined
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: allocations.length,
                projectScope: projectName,
                allocations,
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__get_port_utilization': {
        const utilization = await portManager.getUtilization(args.projectName as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectName: args.projectName,
                utilization,
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__release_port': {
        const released = await portManager.releasePort(args.port as number);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: released,
                port: args.port,
                message: released ? 'Port released successfully' : 'Port not found or already released',
              }, null, 2),
            },
          ],
        };
      }

      // ==================== TASKS ====================
      case 'mcp__meta__start_task': {
        const task = await taskTimer.startTask(
          args.taskId as string,
          args.taskType as string,
          args.taskDescription as string,
          {
            estimatedSeconds: args.estimatedSeconds as number | undefined,
            projectName: args.projectName as string | undefined,
            complexity: args.complexity as 'simple' | 'moderate' | 'complex' | undefined,
          }
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                taskId: task.taskId,
                startedAt: task.startedAt,
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__complete_task': {
        const task = await taskTimer.completeTask(args.taskId as string, {
          filesChanged: args.filesChanged as number | undefined,
          linesChanged: args.linesChanged as number | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                taskId: args.taskId,
                durationSeconds: task?.durationSeconds,
                status: task?.status,
              }, null, 2),
            },
          ],
        };
      }

      case 'mcp__meta__get_task_stats': {
        // Project scoping: Override projectName filter if not meta
        const filterProjectName = projectName === 'meta'
          ? (args.projectName as string | undefined)
          : projectName;

        const stats = await taskTimer.getStats({
          taskType: args.taskType as string | undefined,
          projectName: filterProjectName,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                projectScope: projectName,
                stats,
              }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: `Unknown tool: ${name}`,
              }, null, 2),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Supervisor MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
