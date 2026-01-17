import { config } from '../config';

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

/**
 * Build MCP server configurations for a project
 * Based on SCAR's proven pattern for MCP integration
 */
export function buildMcpServers(_projectName: string): Record<string, McpServerConfig> {
  const servers: Record<string, McpServerConfig> = {};
  
  // GitHub MCP Server - for issue management, comments, etc.
  if (config.mcp.githubEnabled) {
    servers.github = {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: config.github.token,
      },
    };
  }
  
  // Archon MCP Server - for task management and knowledge base
  // Only enable if explicitly configured (Phase 3+)
  if (config.mcp.archonEnabled) {
    servers.archon = {
      command: 'node',
      args: ['/path/to/archon-mcp-server'], // TODO: Update with actual path
      env: {
        // Archon-specific environment variables
      },
    };
  }
  
  return servers;
}

/**
 * Get working directory for a project
 */
export function getProjectWorkingDirectory(projectName: string): string {
  return config.paths.supervisorRoot + '/' + projectName;
}

/**
 * Get implementation workspace for a project
 */
export function getProjectImplementationDirectory(projectName: string): string {
  return config.paths.archonWorkspaces + '/' + projectName;
}
