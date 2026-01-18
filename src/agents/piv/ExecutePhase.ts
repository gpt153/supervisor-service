/**
 * Execute Phase - Implementation and Validation
 *
 * Adapted from Cole Medin's PIV loop for local execution.
 * This phase executes the prescriptive plan created by PlanPhase,
 * runs validation after each phase, and creates a PR when complete.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import {
  PlanResult,
  ExecuteResult,
  ValidationResult,
  ImplementationPhase,
  PrescriptiveTask,
} from './types.js';

const execAsync = promisify(exec);

export class ExecutePhase {
  private workspacePath: string;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Execute implementation plan: Build files and validate
   */
  async execute(
    planResult: PlanResult,
    epicId: string,
    projectName: string
  ): Promise<ExecuteResult> {
    console.log(`[Execute] Starting implementation for ${epicId}...`);

    const filesChanged: string[] = [];
    const validationResults: ValidationResult[] = [];
    let success = true;
    let errorMessage: string | undefined;

    try {
      // 1. Create feature branch
      const branchName = `feature/${epicId}`;
      await this.createFeatureBranch(branchName);

      // 2. Execute each phase
      for (const phase of planResult.phases) {
        console.log(`[Execute] Phase ${phase.phaseNumber}: ${phase.name}`);

        try {
          // Execute tasks in phase
          const phaseFiles = await this.executePhase(phase);
          filesChanged.push(...phaseFiles);

          // Run validation
          const validation = await this.runValidation(phase);
          validationResults.push(validation);

          if (!validation.success) {
            success = false;
            errorMessage = `Validation failed for phase ${phase.phaseNumber}: ${validation.output}`;

            // Retry if allowed
            if (validation.retryCount < 1) {
              console.log(`[Execute] Retrying phase ${phase.phaseNumber}...`);
              const retryValidation = await this.runValidation(phase);
              validationResults.push(retryValidation);

              if (!retryValidation.success) {
                throw new Error(`Phase ${phase.phaseNumber} failed after retry`);
              }
            } else {
              throw new Error(`Phase ${phase.phaseNumber} validation failed`);
            }
          }
        } catch (phaseError) {
          success = false;
          errorMessage = phaseError instanceof Error ? phaseError.message : String(phaseError);
          console.error(`[Execute] Phase ${phase.phaseNumber} failed:`, errorMessage);
          break;
        }
      }

      // 3. Commit changes
      if (success && filesChanged.length > 0) {
        await this.commitChanges(epicId, filesChanged);
      }

      // 4. Create PR (stub - would need GitHub integration)
      let prNumber: number | undefined;
      let prUrl: string | undefined;

      if (success) {
        const pr = await this.createPullRequest(epicId, branchName, projectName);
        prNumber = pr.number;
        prUrl = pr.url;
      }

      return {
        success,
        branchName,
        prNumber,
        prUrl,
        filesChanged,
        validationResults,
        errorMessage,
      };
    } catch (error) {
      return {
        success: false,
        branchName: `feature/${epicId}`,
        filesChanged,
        validationResults,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create a feature branch for this implementation
   */
  private async createFeatureBranch(branchName: string): Promise<void> {
    try {
      await execAsync(`git checkout -b ${branchName}`, { cwd: this.workspacePath });
      console.log(`[Execute] Created branch: ${branchName}`);
    } catch (error) {
      // Branch might already exist
      console.warn(`[Execute] Could not create branch ${branchName}:`, error);
      await execAsync(`git checkout ${branchName}`, { cwd: this.workspacePath });
    }
  }

  /**
   * Execute all tasks in a phase
   */
  private async executePhase(phase: ImplementationPhase): Promise<string[]> {
    const filesChanged: string[] = [];

    for (const task of phase.tasks) {
      try {
        await this.executeTask(task);
        filesChanged.push(task.filePath);
        console.log(`[Execute] Completed task ${task.taskNumber}: ${task.action} ${task.filePath}`);
      } catch (error) {
        console.error(`[Execute] Task ${task.taskNumber} failed:`, error);
        throw error;
      }
    }

    return filesChanged;
  }

  /**
   * Execute a single prescriptive task
   */
  private async executeTask(task: PrescriptiveTask): Promise<void> {
    const fullPath = path.join(this.workspacePath, task.filePath);

    switch (task.action) {
      case 'create':
        // Create file with instructions as a comment
        // In production, this would use an LLM to generate actual code
        const content = this.generateFileContent(task);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, 'utf-8');
        break;

      case 'update':
        // Update existing file
        // In production, this would use an LLM to modify the file
        const existingContent = await fs.readFile(fullPath, 'utf-8');
        const updatedContent = existingContent + '\n\n// Updated by PIV Execute phase\n';
        await fs.writeFile(fullPath, updatedContent, 'utf-8');
        break;

      case 'delete':
        // Delete file
        await fs.unlink(fullPath);
        break;

      case 'rename':
        // Rename file
        // This would need additional logic to parse the new name
        break;
    }
  }

  /**
   * Generate file content based on task instructions
   * NOTE: This is a stub - in production, this would use an LLM
   */
  private generateFileContent(task: PrescriptiveTask): string {
    // For TypeScript files
    if (task.filePath.endsWith('.ts')) {
      return `/**
 * ${path.basename(task.filePath)}
 *
 * Generated by PIV Execute phase
 *
 * Instructions:
 * ${task.instructions.split('\n').join('\n * ')}
 */

// TODO: Implement according to instructions above

export class ${this.inferClassName(task.filePath)} {
  constructor() {
    // Implementation
  }
}
`;
    }

    // Default: Plain text with instructions
    return `# ${path.basename(task.filePath)}

Instructions:
${task.instructions}

TODO: Implement
`;
  }

  /**
   * Infer class name from file path
   */
  private inferClassName(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename.charAt(0).toUpperCase() + basename.slice(1);
  }

  /**
   * Run validation command for a phase
   */
  private async runValidation(phase: ImplementationPhase): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(phase.validationCommand, {
        cwd: this.workspacePath,
        timeout: 120000, // 2 minutes
      });

      const durationSeconds = (Date.now() - startTime) / 1000;

      return {
        phase: phase.phaseNumber,
        command: phase.validationCommand,
        success: true,
        output: stdout || stderr,
        durationSeconds,
        retryCount: 0,
      };
    } catch (error) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const output = error instanceof Error ? error.message : String(error);

      return {
        phase: phase.phaseNumber,
        command: phase.validationCommand,
        success: false,
        output,
        durationSeconds,
        retryCount: 0,
      };
    }
  }

  /**
   * Commit changes to Git
   */
  private async commitChanges(epicId: string, filesChanged: string[]): Promise<void> {
    try {
      // Stage files
      for (const file of filesChanged) {
        await execAsync(`git add "${file}"`, { cwd: this.workspacePath });
      }

      // Commit
      const message = `feat: Implement ${epicId}\n\nCo-Authored-By: PIV Agent <noreply@supervisor-service>`;
      await execAsync(`git commit -m "${message}"`, { cwd: this.workspacePath });

      console.log(`[Execute] Committed ${filesChanged.length} files`);
    } catch (error) {
      console.error('[Execute] Could not commit changes:', error);
      throw error;
    }
  }

  /**
   * Create a pull request (stub)
   * TODO: Integrate with GitHub CLI or API
   */
  private async createPullRequest(
    epicId: string,
    branchName: string,
    projectName: string
  ): Promise<{ number: number; url: string }> {
    // This is a stub - in production, use GitHub CLI or API
    console.log(`[Execute] Would create PR for ${branchName} (epic: ${epicId})`);

    // For now, just return a mock PR
    return {
      number: 0,
      url: `https://github.com/gpt153/${projectName}/pull/0`,
    };

    // Production implementation:
    // const { stdout } = await execAsync(
    //   `gh pr create --title "Implement ${epicId}" --body "Automated PR from PIV loop"`,
    //   { cwd: this.workspacePath }
    // );
    // const prUrl = stdout.trim();
    // const prNumber = parseInt(prUrl.split('/').pop() || '0', 10);
    // return { number: prNumber, url: prUrl };
  }
}
