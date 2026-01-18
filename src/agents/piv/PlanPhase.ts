/**
 * Plan Phase - Create Detailed Implementation Plan
 *
 * Adapted from Cole Medin's PIV loop for local execution.
 * This phase creates a prescriptive, step-by-step plan that can be
 * executed by a cheaper model (Haiku) in the Execute phase.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  Epic,
  PrimeResult,
  PlanResult,
  ImplementationPhase,
  PrescriptiveTask,
  ValidationCommand,
  CodeConventions,
} from './types.js';

export class PlanPhase {
  constructor(_workspacePath: string) {
    // workspacePath stored for future use
  }

  /**
   * Execute Plan phase: Create detailed implementation plan
   */
  async execute(
    contextPath: string,
    epic: Epic,
    primeResult: PrimeResult
  ): Promise<PlanResult> {
    console.log(`[Plan] Creating implementation plan for ${epic.id}...`);

    // 1. Read context document (currently unused but validates file exists)
    await fs.readFile(contextPath, 'utf-8');

    // 2. Design solution approach
    const phases = await this.designPhases(epic, primeResult);

    // 3. Create validation commands
    const validationCommands = this.createValidationCommands(phases);

    // 4. Estimate duration
    const estimatedDuration = phases.reduce((sum, phase) => sum + phase.estimatedMinutes * 60, 0);

    // 5. Write plan document
    const planPath = path.join(
      path.dirname(contextPath),
      `plan-${epic.id}.md`
    );

    await fs.writeFile(planPath, this.formatPlan(epic, phases, validationCommands), 'utf-8');

    console.log(`[Plan] Implementation plan created: ${planPath}`);

    return {
      planPath,
      phases,
      validationCommands,
      estimatedDuration,
      readyForExecute: true,
    };
  }

  /**
   * Design implementation phases based on epic and context
   */
  private async designPhases(epic: Epic, primeResult: PrimeResult): Promise<ImplementationPhase[]> {
    const phases: ImplementationPhase[] = [];

    // This is a simplified version - in production, this would use
    // an LLM (Sonnet) to analyze the epic and create a detailed plan

    // For now, create a basic structure based on epic tasks
    let phaseNumber = 1;

    for (const task of epic.tasks) {
      const phase: ImplementationPhase = {
        phaseNumber,
        name: `Phase ${phaseNumber}: ${task}`,
        description: task,
        tasks: this.createPrescriptiveTasks(task, phaseNumber, primeResult.conventions),
        validationCommand: this.inferValidationCommand(task, primeResult.techStack),
        estimatedMinutes: 15, // Default estimate
      };

      phases.push(phase);
      phaseNumber++;
    }

    return phases;
  }

  /**
   * Create prescriptive tasks for a phase
   */
  private createPrescriptiveTasks(
    taskDescription: string,
    phaseNumber: number,
    conventions: CodeConventions
  ): PrescriptiveTask[] {
    // This is simplified - in production, an LLM would generate detailed tasks
    const tasks: PrescriptiveTask[] = [];

    // Infer file path and action from task description
    const fileMatch = taskDescription.match(/(?:Create|Update|Delete)\s+([A-Za-z0-9_.-]+)/i);
    const action = taskDescription.toLowerCase().includes('create')
      ? 'create'
      : taskDescription.toLowerCase().includes('update')
      ? 'update'
      : taskDescription.toLowerCase().includes('delete')
      ? 'delete'
      : 'create';

    const fileName = fileMatch ? fileMatch[1] : `file-${phaseNumber}.ts`;

    tasks.push({
      taskNumber: 1,
      action,
      filePath: `src/agents/piv/${fileName}`,
      instructions: `
${action === 'create' ? 'Create a new file' : action === 'update' ? 'Update the existing file' : 'Delete the file'}: ${fileName}

Follow these conventions:
- Import style: ${conventions.imports.style}
- File extensions: ${conventions.imports.extensions ? 'Required (.js)' : 'Not required'}
- Indentation: ${conventions.formatting.indentation} (${conventions.formatting.indentSize || 2})
- Quotes: ${conventions.formatting.quotes}
- Error handling: ${conventions.errorHandling.pattern}

Implementation:
${taskDescription}

Acceptance criteria:
- Code follows project conventions
- TypeScript types are properly defined
- Error handling is implemented
- File can be imported without errors
      `.trim(),
      acceptanceCriteria: [
        'File follows naming conventions',
        'TypeScript compiles without errors',
        'Code is properly formatted',
        'Imports use correct style and extensions',
      ],
    });

    return tasks;
  }

  /**
   * Infer validation command from task and tech stack
   */
  private inferValidationCommand(_task: string, techStack: string[]): string {
    // Check if TypeScript
    if (techStack.includes('TypeScript')) {
      return 'npm run build';
    }

    // Check if testing framework
    if (techStack.includes('Vitest')) {
      return 'npm run test';
    }

    if (techStack.includes('Jest')) {
      return 'npm test';
    }

    // Default: just check syntax
    return 'node --check src/**/*.js';
  }

  /**
   * Create validation commands for all phases
   */
  private createValidationCommands(phases: ImplementationPhase[]): ValidationCommand[] {
    return phases.map((phase) => ({
      phase: phase.phaseNumber,
      command: phase.validationCommand,
      timeoutSeconds: 120,
      retryOnFail: true,
    }));
  }

  /**
   * Format plan document as markdown
   */
  private formatPlan(
    epic: Epic,
    phases: ImplementationPhase[],
    validationCommands: ValidationCommand[]
  ): string {
    return `# Implementation Plan: ${epic.id}

**Epic:** ${epic.title}
**Created:** ${new Date().toISOString()}

---

## Overview

${epic.description}

---

## Acceptance Criteria

${epic.acceptanceCriteria.map((criteria, i) => `${i + 1}. ${criteria}`).join('\n')}

---

## Implementation Phases

${phases.map((phase) => `
### ${phase.name}

**Description:** ${phase.description}

**Estimated time:** ${phase.estimatedMinutes} minutes

**Tasks:**

${phase.tasks.map((task) => `
#### Task ${task.taskNumber}: ${task.action.toUpperCase()} ${path.basename(task.filePath)}

**File:** \`${task.filePath}\`

**Instructions:**

\`\`\`
${task.instructions}
\`\`\`

**Acceptance Criteria:**
${task.acceptanceCriteria.map((ac) => `- ${ac}`).join('\n')}
`).join('\n')}

**Validation:**
\`\`\`bash
${phase.validationCommand}
\`\`\`

---
`).join('\n')}

## Validation Commands

${validationCommands.map((cmd) => `
### Phase ${cmd.phase}
\`\`\`bash
${cmd.command}
\`\`\`
- Timeout: ${cmd.timeoutSeconds}s
- Retry on fail: ${cmd.retryOnFail ? 'Yes' : 'No'}
`).join('\n')}

---

## Total Estimated Duration

${Math.round(phases.reduce((sum, p) => sum + p.estimatedMinutes, 0))} minutes

---

**Ready for Execute phase**
`;
  }
}
