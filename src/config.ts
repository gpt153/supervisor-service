import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  anthropicApiKey: string;
  
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    url: string;
  };
  
  github: {
    token: string;
    webhookSecret: string;
  };
  
  telegram?: {
    enabled: boolean;
    botToken?: string;
  };
  
  web?: {
    dashboardEnabled: boolean;
  };
  
  api?: {
    enabled: boolean;
    jwtSecret?: string;
    apiKeys?: string[];
  };
  
  port: number;
  nodeEnv: string;
  logLevel: string;
  
  paths: {
    supervisorRoot: string;
    archonWorkspaces: string;
  };
  
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
  
  telegram: {
    enabled: getEnvVarOptional('TELEGRAM_ENABLED', 'false') === 'true',
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  
  web: {
    dashboardEnabled: getEnvVarOptional('WEB_DASHBOARD_ENABLED', 'true') === 'true',
  },
  
  api: {
    enabled: getEnvVarOptional('REST_API_ENABLED', 'true') === 'true',
    jwtSecret: process.env.JWT_SECRET,
    apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : [],
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
