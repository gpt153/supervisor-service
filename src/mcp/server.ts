import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { config } from '../config';

// Import tool modules
import { registerPlanningTools } from './tools/planning';
import { registerGitTools } from './tools/git';
import { registerGitHubTools } from './tools/github';
import { registerScarTools } from './tools/scar';
import { registerVerificationTools } from './tools/verification';
import { registerKnowledgeTools } from './tools/knowledge';

/**
 * MCP Server for Supervisor Service
 * 
 * Provides tools for Claude.ai Projects to interact with:
 * - Planning files (epics, ADRs, workflow status)
 * - Git operations (status, commit, push)
 * - GitHub API (issues, comments, labels)
 * - SCAR monitoring (progress, worktrees)
 * - Verification (build, tests, mocks)
 * - Knowledge base (learnings, docs)
 */

export class SupervisorMCPServer {
  private server: Server;
  private pool: Pool;
  private tools: Map<string, Tool> = new Map();
  private toolHandlers: Map<string, Function> = new Map();

  constructor() {
    // Initialize MCP server
    this.server = new Server(
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

    // Initialize database pool
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
    });

    // Register request handlers
    this.setupHandlers();

    // Register all tools
    this.registerAllTools();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()),
      };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const handler = this.toolHandlers.get(toolName);

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
              text: JSON.stringify({
                error: errorMessage,
                success: false,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Register a tool with its handler
   */
  private registerTool(tool: Tool, handler: Function): void {
    this.tools.set(tool.name, tool);
    this.toolHandlers.set(tool.name, handler);
  }

  /**
   * Register all tools from different modules
   */
  private registerAllTools(): void {
    const context = {
      pool: this.pool,
      registerTool: this.registerTool.bind(this),
    };

    // Register tools from each module
    registerPlanningTools(context);
    registerGitTools(context);
    registerGitHubTools(context);
    registerScarTools(context);
    registerVerificationTools(context);
    registerKnowledgeTools(context);

    console.log(`Registered ${this.tools.size} MCP tools`);
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Create stdio transport for Claude.ai Projects
    const transport = new StdioServerTransport();

    // Connect server to transport
    await this.server.connect(transport);

    console.log('Supervisor MCP server started');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down MCP server...');
    await this.pool.end();
    await this.server.close();
    console.log('MCP server stopped');
  }
}

// Export for use in main entry point
export interface ToolContext {
  pool: Pool;
  registerTool: (tool: Tool, handler: Function) => void;
}
