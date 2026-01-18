import fs from 'fs/promises';
import path from 'path';

/**
 * InstructionAssembler - Assembles CLAUDE.md from layered instruction files
 *
 * Architecture:
 * 1. Core instructions (.supervisor-core/) - Shared across all supervisors
 * 2. Meta-specific instructions (.supervisor-meta/) - Only for meta-supervisor
 * 3. Project-specific instructions (.claude-specific/) - Custom per project
 *
 * CLAUDE.md is auto-generated from these layers and should NOT be edited directly.
 */

interface InstructionLayer {
  name: string;
  path: string;
  content: string;
}

export class InstructionAssembler {
  private readonly rootPath: string;
  private readonly corePath: string;
  private readonly metaPath: string;

  constructor(rootPath: string = '/home/samuel/sv/supervisor-service') {
    this.rootPath = rootPath;
    this.corePath = path.join(rootPath, '.supervisor-core');
    this.metaPath = path.join(rootPath, '.supervisor-meta');
  }

  /**
   * Assemble CLAUDE.md for meta-supervisor
   */
  async assembleForMeta(): Promise<string> {
    const coreInstructions = await this.getCoreInstructions();
    const metaInstructions = await this.getMetaInstructions();

    const timestamp = new Date().toISOString();

    return `<!-- AUTO-GENERATED: Do not edit directly -->
<!-- Last updated: ${timestamp} -->
<!-- Generator: InstructionAssembler -->

# Meta-Supervisor

${this.wrapSection('CORE INSTRUCTIONS', coreInstructions)}

${this.wrapSection('META-SPECIFIC INSTRUCTIONS', metaInstructions)}

---

**This file is auto-generated. To update:**
- Edit files in \`.supervisor-core/\` for shared behaviors
- Edit files in \`.supervisor-meta/\` for meta-specific behaviors
- Run: \`npm run assemble-instructions\` or use MCP tool \`mcp__meta__regenerate_supervisor\`
`.trim();
  }

  /**
   * Assemble CLAUDE.md for project-specific supervisor
   */
  async assembleForProject(projectName: string, projectPath: string): Promise<string> {
    const coreInstructions = await this.getCoreInstructions();
    const projectInstructions = await this.getProjectInstructions(projectPath, projectName);

    const timestamp = new Date().toISOString();
    const projectTitle = projectName.charAt(0).toUpperCase() + projectName.slice(1);

    return `<!-- AUTO-GENERATED: Do not edit directly -->
<!-- Last updated: ${timestamp} -->
<!-- Generator: InstructionAssembler -->

# ${projectTitle} Supervisor

${this.wrapSection('CORE INSTRUCTIONS', coreInstructions)}

${this.wrapSection('PROJECT-SPECIFIC INSTRUCTIONS', projectInstructions)}

---

**This file is auto-generated. To update:**
- Edit files in \`.supervisor-core/\` for shared behaviors (affects all supervisors)
- Edit files in \`.claude-specific/${projectName}-custom.md\` for project-specific behaviors
- Run: \`npm run assemble-instructions\` or use MCP tool \`mcp__meta__regenerate_supervisor\`
`.trim();
  }

  /**
   * Get all core instruction files
   */
  private async getCoreInstructions(): Promise<string> {
    const coreFiles = [
      'core-behaviors.md',
      'tool-usage.md',
      'bmad-methodology.md',
    ];

    const layers: InstructionLayer[] = [];

    for (const file of coreFiles) {
      const filePath = path.join(this.corePath, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        layers.push({
          name: file,
          path: filePath,
          content: content.trim(),
        });
      } catch (error) {
        console.error(`Warning: Could not read core instruction file: ${filePath}`);
        // Continue with other files
      }
    }

    return layers.map(layer => layer.content).join('\n\n---\n\n');
  }

  /**
   * Get meta-specific instruction files
   */
  private async getMetaInstructions(): Promise<string> {
    const metaFiles = [
      'meta-specific.md',
    ];

    const layers: InstructionLayer[] = [];

    for (const file of metaFiles) {
      const filePath = path.join(this.metaPath, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        layers.push({
          name: file,
          path: filePath,
          content: content.trim(),
        });
      } catch (error) {
        // Meta-specific files might not exist yet - that's OK
        console.warn(`Meta instruction file not found: ${filePath}`);
      }
    }

    if (layers.length === 0) {
      return '<!-- No meta-specific instructions yet -->';
    }

    return layers.map(layer => layer.content).join('\n\n---\n\n');
  }

  /**
   * Get project-specific instruction files
   */
  private async getProjectInstructions(projectPath: string, projectName: string): Promise<string> {
    const customFilePath = path.join(projectPath, '.claude-specific', `${projectName}-custom.md`);

    try {
      const content = await fs.readFile(customFilePath, 'utf-8');
      return content.trim();
    } catch (error) {
      // Project-specific file doesn't exist - create a placeholder
      return `# ${projectName.charAt(0).toUpperCase() + projectName.slice(1)}-Specific Instructions

**Project:** ${projectName}
**Repository:** (configure repository URL)
**Tech Stack:** (configure tech stack)
**Working Directory:** ${projectPath}

## Custom Behaviors

(Add project-specific behaviors here)

## Tech Stack Details

(Document tech stack specifics here)

## Common Errors

(Document project-specific error handling here)

## Deployment

(Document deployment process here)
`;
    }
  }

  /**
   * Wrap a section with HTML comments for identification
   */
  private wrapSection(sectionName: string, content: string): string {
    return `<!-- BEGIN ${sectionName} -->
${content}
<!-- END ${sectionName} -->`;
  }

  /**
   * Regenerate all CLAUDE.md files (meta + all projects)
   */
  async regenerateAll(projects: string[] = []): Promise<RegenerationResult[]> {
    const results: RegenerationResult[] = [];

    // Regenerate meta-supervisor
    try {
      const metaContent = await this.assembleForMeta();
      const metaPath = path.join(this.rootPath, 'CLAUDE.md');
      await fs.writeFile(metaPath, metaContent, 'utf-8');
      results.push({
        success: true,
        name: 'meta',
        path: metaPath,
      });
    } catch (error) {
      results.push({
        success: false,
        name: 'meta',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Regenerate project supervisors
    for (const projectName of projects) {
      try {
        const projectPath = path.join('/home/samuel/supervisor', projectName);
        const projectContent = await this.assembleForProject(projectName, projectPath);
        const claudePath = path.join(projectPath, 'CLAUDE.md');

        // Ensure directory exists
        await fs.mkdir(path.dirname(claudePath), { recursive: true });
        await fs.writeFile(claudePath, projectContent, 'utf-8');

        results.push({
          success: true,
          name: projectName,
          path: claudePath,
        });
      } catch (error) {
        results.push({
          success: false,
          name: projectName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Update a specific core instruction file
   */
  async updateCoreInstruction(filename: string, content: string): Promise<void> {
    const filePath = path.join(this.corePath, filename);
    await fs.mkdir(this.corePath, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Update a project-specific instruction file
   */
  async updateProjectInstruction(projectName: string, projectPath: string, content: string): Promise<void> {
    const customDir = path.join(projectPath, '.claude-specific');
    const filePath = path.join(customDir, `${projectName}-custom.md`);

    await fs.mkdir(customDir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Get list of all projects (directories in /home/samuel/supervisor)
   */
  async getProjects(): Promise<string[]> {
    const supervisorRoot = '/home/samuel/supervisor';
    try {
      const entries = await fs.readdir(supervisorRoot, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .filter(entry => !entry.name.startsWith('.'))
        .filter(entry => !['docs', 'templates', 'node_modules'].includes(entry.name))
        .map(entry => entry.name);
    } catch (error) {
      console.error('Error reading supervisor directory:', error);
      return [];
    }
  }
}

interface RegenerationResult {
  success: boolean;
  name: string;
  path?: string;
  error?: string;
}

export default InstructionAssembler;
