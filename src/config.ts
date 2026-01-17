import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
  // Claude API
  anthropicApiKey: string;
  
  // Database
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    url: string;
  };
  
  // GitHub
  github: {
    token: string;
    webhookSecret: string;
  };
  
  // Service
  port: number;
  nodeEnv: string;
  logLevel: string;
  
  // Paths
  paths: {
    supervisorRoot: string;
    archonWorkspaces: string;
  };
  
  // MCP
  mcp: {
    githubEnabled: boolean;
    archonEnabled: boolean;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error('Missing required environment variable: ' + key);
  }
  return value;
}

function getEnvVarOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config: Config = {
  anthropicApiKey: getEnvVar('ANTHROPIC_API_KEY'),
  
  database: {
    host: getEnvVarOptional('DATABASE_HOST', 'localhost'),
    port: parseInt(getEnvVarOptional('DATABASE_PORT', '5432'), 10),
    name: getEnvVarOptional('DATABASE_NAME', 'supervisor_service'),
    user: getEnvVarOptional('DATABASE_USER', 'supervisor'),
    password: getEnvVar('DATABASE_PASSWORD'),
    url: getEnvVar('DATABASE_URL'),
  },
  
  github: {
    token: getEnvVar('GITHUB_TOKEN'),
    webhookSecret: getEnvVarOptional('GITHUB_WEBHOOK_SECRET', ''),
  },
  
  port: parseInt(getEnvVarOptional('PORT', '8080'), 10),
  nodeEnv: getEnvVarOptional('NODE_ENV', 'development'),
  logLevel: getEnvVarOptional('LOG_LEVEL', 'info'),
  
  paths: {
    supervisorRoot: getEnvVarOptional('SUPERVISOR_ROOT', '/home/samuel/supervisor'),
    archonWorkspaces: getEnvVarOptional('ARCHON_WORKSPACES', '/home/samuel/.archon/workspaces'),
  },
  
  mcp: {
    githubEnabled: getEnvVarOptional('MCP_GITHUB_ENABLED', 'true') === 'true',
    archonEnabled: getEnvVarOptional('MCP_ARCHON_ENABLED', 'false') === 'true',
  },
};
