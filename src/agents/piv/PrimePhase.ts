/**
 * Prime Phase - Codebase Research and Analysis
 *
 * Adapted from Cole Medin's PIV loop for local execution.
 * This phase analyzes the codebase to understand:
 * - Project structure and tech stack
 * - Naming conventions and patterns
 * - Dependencies and integration points
 * - Similar implementations (via RAG)
 */

import fs from 'fs/promises';
import path from 'path';
import {
  ProjectContext,
  Epic,
  PrimeResult,
  CodeConventions,
  RAGInsight,
  IntegrationPoint,
} from './types.js';

export class PrimePhase {
  constructor(_workspacePath: string) {
    // workspacePath stored for future use
  }

  /**
   * Execute Prime phase: Analyze codebase and create context document
   */
  async execute(project: ProjectContext, epic: Epic): Promise<PrimeResult> {
    console.log(`[Prime] Starting analysis for ${epic.id}...`);

    // 1. Analyze project structure
    const structure = await this.analyzeStructure(project.path);

    // 2. Find naming conventions
    const conventions = await this.findConventions(project.path, structure.techStack);

    // 3. Analyze dependencies
    const dependencies = await this.analyzeDependencies(project.path);

    // 4. Search local RAG for similar patterns (stub for now)
    const ragInsights = await this.searchRAG(project.name, epic);

    // 5. Find integration points
    const integrationPoints = await this.findIntegrationPoints(project.path, structure.techStack);

    // 6. Create context document
    const contextDoc = {
      project: project.name,
      epic: epic.id,
      techStack: structure.techStack,
      conventions,
      dependencies,
      ragInsights,
      integrationPoints,
      analysisDate: new Date().toISOString(),
    };

    const contextPath = path.join(project.path, '.agents', 'plans', `context-${epic.id}.md`);
    await fs.mkdir(path.dirname(contextPath), { recursive: true });
    await fs.writeFile(contextPath, this.formatContext(contextDoc), 'utf-8');

    console.log(`[Prime] Context document created: ${contextPath}`);

    return {
      contextPath,
      techStack: structure.techStack,
      conventions,
      ragInsights,
      integrationPoints,
      readyForPlan: true,
    };
  }

  /**
   * Analyze project structure to detect tech stack
   */
  private async analyzeStructure(projectPath: string): Promise<{ techStack: string[] }> {
    const techStack: string[] = [];

    try {
      // Check for package.json (Node.js/TypeScript)
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      if (packageJson.dependencies || packageJson.devDependencies) {
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Detect TypeScript
        if (allDeps.typescript) {
          techStack.push('TypeScript');
        } else {
          techStack.push('JavaScript');
        }

        // Detect frameworks
        if (allDeps.react) techStack.push('React');
        if (allDeps.vue) techStack.push('Vue');
        if (allDeps.express) techStack.push('Express');
        if (allDeps['@anthropic-ai/sdk']) techStack.push('Anthropic SDK');
        if (allDeps['@modelcontextprotocol/sdk']) techStack.push('MCP');

        // Detect testing frameworks
        if (allDeps.vitest) techStack.push('Vitest');
        if (allDeps.jest) techStack.push('Jest');

        // Detect databases
        if (allDeps.pg) techStack.push('PostgreSQL');
        if (allDeps.mongodb) techStack.push('MongoDB');
      }

      // Check for tsconfig.json
      const tsconfigPath = path.join(projectPath, 'tsconfig.json');
      try {
        await fs.access(tsconfigPath);
        if (!techStack.includes('TypeScript')) {
          techStack.push('TypeScript');
        }
      } catch {
        // tsconfig.json doesn't exist
      }
    } catch (error) {
      console.warn('[Prime] Could not analyze package.json:', error);
    }

    return { techStack };
  }

  /**
   * Find code conventions by analyzing existing files
   */
  private async findConventions(
    projectPath: string,
    techStack: string[]
  ): Promise<CodeConventions> {
    // Default conventions (sensible defaults)
    const conventions: CodeConventions = {
      naming: {
        files: 'kebab-case',
        classes: 'PascalCase',
        functions: 'camelCase',
        variables: 'camelCase',
      },
      imports: {
        style: 'esm',
        extensions: techStack.includes('TypeScript'),
      },
      formatting: {
        indentation: 'spaces',
        indentSize: 2,
        quotes: 'single',
      },
      errorHandling: {
        pattern: 'try-catch',
        customErrors: false,
      },
      testing: {
        framework: techStack.includes('Vitest') ? 'vitest' : techStack.includes('Jest') ? 'jest' : undefined,
      },
    };

    try {
      // Sample a few TypeScript/JavaScript files to detect patterns
      const srcPath = path.join(projectPath, 'src');
      const files = await this.findSourceFiles(srcPath, 5); // Sample 5 files

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');

        // Detect import style
        if (content.includes('import ') && content.includes(' from ')) {
          conventions.imports.style = 'esm';
          // Check if extensions are used
          if (content.match(/from ['"]\.\/.*\.js['"]/)) {
            conventions.imports.extensions = true;
          }
        } else if (content.includes('require(')) {
          conventions.imports.style = 'commonjs';
        }

        // Detect quote style
        const singleQuotes = (content.match(/'/g) || []).length;
        const doubleQuotes = (content.match(/"/g) || []).length;
        conventions.formatting.quotes = singleQuotes > doubleQuotes ? 'single' : 'double';

        // Detect custom error classes
        if (content.includes('extends Error')) {
          conventions.errorHandling.customErrors = true;
        }
      }
    } catch (error) {
      console.warn('[Prime] Could not analyze conventions:', error);
    }

    return conventions;
  }

  /**
   * Find source files for sampling
   */
  private async findSourceFiles(dir: string, limit: number): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= limit) break;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subFiles = await this.findSourceFiles(fullPath, limit - files.length);
          files.push(...subFiles);
        } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or not accessible
    }

    return files;
  }

  /**
   * Analyze dependencies from package.json
   */
  private async analyzeDependencies(projectPath: string): Promise<Record<string, string>> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      return {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
    } catch (error) {
      console.warn('[Prime] Could not analyze dependencies:', error);
      return {};
    }
  }

  /**
   * Search local RAG for relevant patterns (stub for now)
   * TODO: Integrate with actual RAG system when available
   */
  private async searchRAG(_projectName: string, _epic: Epic): Promise<RAGInsight[]> {
    // Stub: Return empty array for now
    // In production, this would search the local RAG knowledge base
    return [];
  }

  /**
   * Find integration points (APIs, databases, etc.)
   */
  private async findIntegrationPoints(
    _projectPath: string,
    techStack: string[]
  ): Promise<IntegrationPoint[]> {
    const integrationPoints: IntegrationPoint[] = [];

    // Detect database integration
    if (techStack.includes('PostgreSQL')) {
      integrationPoints.push({
        type: 'database',
        name: 'PostgreSQL',
        location: 'src/db/',
        description: 'Database connection pool and queries',
      });
    }

    // Detect MCP integration
    if (techStack.includes('MCP')) {
      integrationPoints.push({
        type: 'api',
        name: 'MCP Server',
        location: 'src/mcp/',
        description: 'Model Context Protocol server and tools',
      });
    }

    // TODO: Scan actual files for API endpoints, database queries, etc.

    return integrationPoints;
  }

  /**
   * Format context document as markdown
   */
  private formatContext(context: any): string {
    return `# Context Document: ${context.epic}

**Project:** ${context.project}
**Generated:** ${context.analysisDate}

---

## Tech Stack

${context.techStack.map((tech: string) => `- ${tech}`).join('\n')}

---

## Code Conventions

### Naming
- Files: ${context.conventions.naming.files}
- Classes: ${context.conventions.naming.classes}
- Functions: ${context.conventions.naming.functions}
- Variables: ${context.conventions.naming.variables}

### Imports
- Style: ${context.conventions.imports.style}
- Extensions required: ${context.conventions.imports.extensions ? 'Yes' : 'No'}

### Formatting
- Indentation: ${context.conventions.formatting.indentation} (${context.conventions.formatting.indentSize || 'default'})
- Quotes: ${context.conventions.formatting.quotes}

### Error Handling
- Pattern: ${context.conventions.errorHandling.pattern}
- Custom errors: ${context.conventions.errorHandling.customErrors ? 'Yes' : 'No'}

### Testing
${context.conventions.testing.framework ? `- Framework: ${context.conventions.testing.framework}` : '- No testing framework detected'}

---

## Dependencies

${Object.entries(context.dependencies)
  .slice(0, 10)
  .map(([name, version]) => `- ${name}: ${version}`)
  .join('\n')}

${Object.keys(context.dependencies).length > 10 ? `\n... and ${Object.keys(context.dependencies).length - 10} more` : ''}

---

## Integration Points

${context.integrationPoints.length > 0
  ? context.integrationPoints.map((ip: IntegrationPoint) => `
### ${ip.name} (${ip.type})
- Location: ${ip.location}
- ${ip.description}
`).join('\n')
  : 'No integration points detected'}

---

## RAG Insights

${context.ragInsights.length > 0
  ? context.ragInsights.map((insight: RAGInsight) => `
### ${insight.category}: ${insight.source}
${insight.content}
`).join('\n')
  : 'No similar patterns found in knowledge base'}

---

**Ready for Plan phase**
`;
  }
}
