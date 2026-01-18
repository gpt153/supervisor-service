/**
 * PIV Loop Type Definitions
 *
 * Prime → Implement → Validate loop with three phases:
 * - Prime: Research and analyze codebase
 * - Plan: Create detailed implementation plan
 * - Execute: Implement and validate
 */

export interface ProjectContext {
  name: string;
  path: string;
  techStack?: string[];
  conventions?: CodeConventions;
  dependencies?: Record<string, string>;
}

export interface CodeConventions {
  naming: {
    files: 'camelCase' | 'kebab-case' | 'PascalCase' | 'snake_case';
    classes: 'PascalCase' | 'camelCase';
    functions: 'camelCase' | 'snake_case';
    variables: 'camelCase' | 'snake_case';
  };
  imports: {
    style: 'esm' | 'commonjs';
    extensions: boolean; // .js extension required
  };
  formatting: {
    indentation: 'tabs' | 'spaces';
    indentSize?: number;
    quotes: 'single' | 'double';
  };
  errorHandling: {
    pattern: 'try-catch' | 'promises' | 'callbacks';
    customErrors: boolean;
  };
  testing: {
    framework?: string;
    pattern?: string;
  };
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: string[];
  dependencies?: string[];
  estimatedHours?: number;
}

export interface PrimeResult {
  contextPath: string;
  techStack: string[];
  conventions: CodeConventions;
  ragInsights: RAGInsight[];
  integrationPoints: IntegrationPoint[];
  readyForPlan: boolean;
}

export interface RAGInsight {
  source: string;
  relevance: number;
  content: string;
  category: 'pattern' | 'solution' | 'warning' | 'best-practice';
}

export interface IntegrationPoint {
  type: 'api' | 'database' | 'file-system' | 'external-service';
  name: string;
  location: string;
  description: string;
}

export interface PlanResult {
  planPath: string;
  phases: ImplementationPhase[];
  validationCommands: ValidationCommand[];
  estimatedDuration: number; // seconds
  readyForExecute: boolean;
}

export interface ImplementationPhase {
  phaseNumber: number;
  name: string;
  description: string;
  tasks: PrescriptiveTask[];
  validationCommand: string;
  estimatedMinutes: number;
}

export interface PrescriptiveTask {
  taskNumber: number;
  action: 'create' | 'update' | 'delete' | 'rename';
  filePath: string;
  instructions: string; // Detailed, step-by-step instructions
  acceptanceCriteria: string[];
}

export interface ValidationCommand {
  phase: number;
  command: string;
  expectedOutput?: string;
  timeoutSeconds: number;
  retryOnFail: boolean;
}

export interface ExecuteResult {
  success: boolean;
  branchName: string;
  prNumber?: number;
  prUrl?: string;
  filesChanged: string[];
  validationResults: ValidationResult[];
  errorMessage?: string;
}

export interface ValidationResult {
  phase: number;
  command: string;
  success: boolean;
  output: string;
  durationSeconds: number;
  retryCount: number;
}

export interface PIVLoopOptions {
  model?: 'haiku' | 'sonnet'; // Default: sonnet for plan, haiku for execute
  skipPrime?: boolean; // Skip Prime if context already exists
  skipValidation?: boolean; // Skip validation (not recommended)
  branchPrefix?: string; // Default: 'feature/'
  autoMergePR?: boolean; // Default: false
}

export interface PIVState {
  epicId: string;
  projectName: string;
  currentPhase: 'prime' | 'plan' | 'execute' | 'complete' | 'failed';
  primeResult?: PrimeResult;
  planResult?: PlanResult;
  executeResult?: ExecuteResult;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}
