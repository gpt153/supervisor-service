import fs from 'fs/promises';
import path from 'path';
import { InstructionAssembler } from './InstructionAssembler.js';

/**
 * AdaptLocalClaude - Analyzes project codebase and optimizes supervisor instructions
 *
 * Purpose:
 * - Detect tech stack from package.json, dependencies, file patterns
 * - Identify common error patterns from git history
 * - Detect naming conventions and code patterns
 * - Generate project-specific instruction optimizations
 * - Update .claude-specific/{project}-custom.md with insights
 */

interface TechStackAnalysis {
  language: string;
  framework?: string;
  libraries: string[];
  buildTools: string[];
  testingFramework?: string;
  database?: string;
  deployment?: string;
}

interface ErrorPattern {
  error: string;
  frequency: number;
  context: string;
  suggestedFix?: string;
}

interface CodePattern {
  type: string;
  pattern: string;
  examples: string[];
}

interface OptimizationResult {
  techStack: TechStackAnalysis;
  errorPatterns: ErrorPattern[];
  codePatterns: CodePattern[];
  recommendations: string[];
  generatedInstructions: string;
}

export class AdaptLocalClaude {
  private readonly projectPath: string;
  private readonly projectName: string;
  private readonly assembler: InstructionAssembler;

  constructor(projectPath: string, projectName: string) {
    this.projectPath = projectPath;
    this.projectName = projectName;
    this.assembler = new InstructionAssembler();
  }

  /**
   * Analyze project and generate optimized instructions
   */
  async analyze(): Promise<OptimizationResult> {
    const techStack = await this.analyzeTechStack();
    const errorPatterns = await this.analyzeErrorPatterns();
    const codePatterns = await this.analyzeCodePatterns();
    const recommendations = this.generateRecommendations(techStack, errorPatterns, codePatterns);
    const generatedInstructions = this.generateInstructions(techStack, errorPatterns, codePatterns, recommendations);

    return {
      techStack,
      errorPatterns,
      codePatterns,
      recommendations,
      generatedInstructions,
    };
  }

  /**
   * Analyze tech stack from package.json and project files
   */
  private async analyzeTechStack(): Promise<TechStackAnalysis> {
    const analysis: TechStackAnalysis = {
      language: 'unknown',
      libraries: [],
      buildTools: [],
    };

    // Check for package.json (Node.js project)
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      analysis.language = 'JavaScript/TypeScript';

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Detect framework
      if (allDeps['react']) analysis.framework = 'React';
      if (allDeps['vue']) analysis.framework = 'Vue';
      if (allDeps['@angular/core']) analysis.framework = 'Angular';
      if (allDeps['svelte']) analysis.framework = 'Svelte';
      if (allDeps['next']) analysis.framework = 'Next.js';
      if (allDeps['express']) analysis.framework = 'Express';
      if (allDeps['fastify']) analysis.framework = 'Fastify';

      // Detect testing framework
      if (allDeps['jest']) analysis.testingFramework = 'Jest';
      if (allDeps['vitest']) analysis.testingFramework = 'Vitest';
      if (allDeps['mocha']) analysis.testingFramework = 'Mocha';
      if (allDeps['@playwright/test']) {
        analysis.testingFramework = analysis.testingFramework
          ? `${analysis.testingFramework} + Playwright`
          : 'Playwright';
      }

      // Detect database
      if (allDeps['pg'] || allDeps['postgres']) analysis.database = 'PostgreSQL';
      if (allDeps['mongodb']) analysis.database = 'MongoDB';
      if (allDeps['mysql']) analysis.database = 'MySQL';
      if (allDeps['@supabase/supabase-js']) analysis.database = 'Supabase';
      if (allDeps['prisma']) analysis.database = analysis.database
        ? `${analysis.database} + Prisma`
        : 'Prisma';

      // Detect build tools
      if (allDeps['vite']) analysis.buildTools.push('Vite');
      if (allDeps['webpack']) analysis.buildTools.push('Webpack');
      if (allDeps['esbuild']) analysis.buildTools.push('ESBuild');
      if (allDeps['rollup']) analysis.buildTools.push('Rollup');

      // Detect deployment hints from scripts
      const scripts = packageJson.scripts || {};
      if (scripts.deploy?.includes('netlify')) analysis.deployment = 'Netlify';
      if (scripts.deploy?.includes('vercel')) analysis.deployment = 'Vercel';
      if (scripts.build?.includes('docker')) analysis.deployment = 'Docker';

      // Collect notable libraries
      const notableLibraries = [
        'tailwindcss', 'axios', 'zod', 'yup', 'react-query',
        'zustand', 'redux', 'mobx', 'stripe', 'openai',
      ];
      analysis.libraries = notableLibraries.filter(lib => allDeps[lib]);

    } catch (error) {
      // Not a Node.js project or package.json doesn't exist
    }

    // Check for Python project
    try {
      await fs.access(path.join(this.projectPath, 'requirements.txt'));
      analysis.language = 'Python';
    } catch {
      // Not a Python project
    }

    // Check for Go project
    try {
      await fs.access(path.join(this.projectPath, 'go.mod'));
      analysis.language = 'Go';
    } catch {
      // Not a Go project
    }

    return analysis;
  }

  /**
   * Analyze common error patterns from git history and logs
   */
  private async analyzeErrorPatterns(): Promise<ErrorPattern[]> {
    const patterns: ErrorPattern[] = [];

    // This would ideally parse git log, error logs, etc.
    // For now, return empty array - can be enhanced later
    // Future: Parse git commit messages for "fix:", "error:", etc.

    return patterns;
  }

  /**
   * Analyze code patterns (naming conventions, structure, etc.)
   */
  private async analyzeCodePatterns(): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // This would ideally analyze source files for patterns
    // For now, return empty array - can be enhanced later
    // Future: Detect naming conventions, file structure, etc.

    return patterns;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    techStack: TechStackAnalysis,
    _errorPatterns: ErrorPattern[],
    _codePatterns: CodePattern[]
  ): string[] {
    const recommendations: string[] = [];

    // Tech stack recommendations
    if (techStack.framework === 'React') {
      recommendations.push('Use React DevTools for debugging component issues');
      recommendations.push('Follow React Hooks best practices (exhaustive dependencies)');
    }

    if (techStack.database === 'Supabase') {
      recommendations.push('Check Row Level Security policies for access errors');
      recommendations.push('Verify Supabase client initialization in _app.tsx');
    }

    if (techStack.testingFramework?.includes('Playwright')) {
      recommendations.push('Run Playwright tests in headed mode for debugging: npx playwright test --headed');
    }

    if (techStack.deployment === 'Netlify') {
      recommendations.push('Check Netlify build logs for deployment failures');
      recommendations.push('Verify environment variables are set in Netlify dashboard');
    }

    // Error pattern recommendations (reserved for future implementation)
    // for (const pattern of errorPatterns) {
    //   if (pattern.suggestedFix) {
    //     recommendations.push(pattern.suggestedFix);
    //   }
    // }

    return recommendations;
  }

  /**
   * Generate project-specific instructions
   */
  private generateInstructions(
    techStack: TechStackAnalysis,
    _errorPatterns: ErrorPattern[],
    _codePatterns: CodePattern[],
    recommendations: string[]
  ): string {
    const projectTitle = this.projectName.charAt(0).toUpperCase() + this.projectName.slice(1);

    let instructions = `# ${projectTitle}-Specific Instructions

**Auto-generated:** ${new Date().toISOString()}
**Project:** ${this.projectName}
**Working Directory:** ${this.projectPath}

## Tech Stack

**Language:** ${techStack.language}
${techStack.framework ? `**Framework:** ${techStack.framework}\n` : ''}${techStack.database ? `**Database:** ${techStack.database}\n` : ''}${techStack.testingFramework ? `**Testing:** ${techStack.testingFramework}\n` : ''}${techStack.deployment ? `**Deployment:** ${techStack.deployment}\n` : ''}${techStack.buildTools.length > 0 ? `**Build Tools:** ${techStack.buildTools.join(', ')}\n` : ''}${techStack.libraries.length > 0 ? `**Notable Libraries:** ${techStack.libraries.join(', ')}\n` : ''}
`;

    if (recommendations.length > 0) {
      instructions += `\n## Recommendations\n\n`;
      recommendations.forEach(rec => {
        instructions += `- ${rec}\n`;
      });
    }

    if (techStack.framework === 'React') {
      instructions += `\n## React-Specific Guidelines

### Common Errors
- **"Cannot read property of undefined"** → Add null checks or optional chaining
- **"Too many re-renders"** → Check useEffect dependencies
- **"Maximum update depth exceeded"** → Avoid setState in render

### Best Practices
- Use functional components and hooks
- Memoize expensive computations with useMemo
- Use useCallback for event handlers passed to children
`;
    }

    if (techStack.database === 'Supabase' || techStack.database?.includes('Supabase')) {
      instructions += `\n## Supabase-Specific Guidelines

### Common Errors
- **"Invalid JWT"** → Token expired, refresh authentication
- **"Row Level Security"** → Check RLS policies in Supabase dashboard
- **"Storage bucket not found"** → Verify bucket name and permissions

### Best Practices
- Always handle authentication errors with retry logic
- Check RLS policies before debugging query issues
- Use Supabase client v2.x (v3 has breaking changes)
`;
    }

    if (techStack.deployment === 'Netlify') {
      instructions += `\n## Deployment (Netlify)

### Pre-Deployment Checklist
- [ ] All tests passing locally
- [ ] Build succeeds locally: \`npm run build\`
- [ ] Environment variables set in Netlify dashboard
- [ ] No hardcoded secrets in code

### Common Deployment Errors
- **"Build failed"** → Check Netlify build logs for specific error
- **"Function timeout"** → Increase timeout in netlify.toml
- **"Environment variable not found"** → Set in Netlify dashboard, redeploy
`;
    }

    instructions += `\n## Custom Behaviors

(Add any project-specific behaviors here)

---

**This file can be manually edited.** Core instructions are auto-generated, but this file is preserved.
`;

    return instructions;
  }

  /**
   * Apply optimizations to project
   */
  async optimize(): Promise<void> {
    const result = await this.analyze();

    // Update project-specific instructions
    await this.assembler.updateProjectInstruction(
      this.projectName,
      this.projectPath,
      result.generatedInstructions
    );

    // Regenerate CLAUDE.md for this project
    const projectContent = await this.assembler.assembleForProject(this.projectName, this.projectPath);
    const claudePath = path.join(this.projectPath, 'CLAUDE.md');
    await fs.writeFile(claudePath, projectContent, 'utf-8');
  }
}

export default AdaptLocalClaude;
