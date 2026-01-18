/**
 * PIV Orchestrator - Main controller for Plan → Implement → Validate loop
 *
 * Adapted from Cole Medin's PIV loop for local execution.
 * Orchestrates the three phases: Prime, Plan, Execute
 */

import { PrimePhase } from './PrimePhase.js';
import { PlanPhase } from './PlanPhase.js';
import { ExecutePhase } from './ExecutePhase.js';
import {
  ProjectContext,
  Epic,
  PIVLoopOptions,
  PIVState,
  PrimeResult,
  PlanResult,
  ExecuteResult,
} from './types.js';

export class PIVOrchestrator {
  private primePhase: PrimePhase;
  private planPhase: PlanPhase;
  private executePhase: ExecutePhase;

  constructor(workspacePath: string) {
    this.primePhase = new PrimePhase(workspacePath);
    this.planPhase = new PlanPhase(workspacePath);
    this.executePhase = new ExecutePhase(workspacePath);
  }

  /**
   * Run the complete PIV loop: Prime → Plan → Execute
   */
  async run(
    project: ProjectContext,
    epic: Epic,
    options: PIVLoopOptions = {}
  ): Promise<PIVState> {
    const state: PIVState = {
      epicId: epic.id,
      projectName: project.name,
      currentPhase: 'prime',
      startedAt: new Date(),
    };

    console.log(`[PIV] Starting PIV loop for ${epic.id}`);

    try {
      // Phase 1: Prime (Research)
      if (!options.skipPrime) {
        console.log('[PIV] Phase 1: Prime (Research)');
        state.currentPhase = 'prime';
        const primeResult = await this.primePhase.execute(project, epic);
        state.primeResult = primeResult;
        console.log('[PIV] Prime phase complete');
      } else {
        console.log('[PIV] Skipping Prime phase (context exists)');
      }

      // Phase 2: Plan (Design)
      console.log('[PIV] Phase 2: Plan (Design)');
      state.currentPhase = 'plan';

      if (!state.primeResult) {
        throw new Error('Prime result is required for Plan phase');
      }

      const planResult = await this.planPhase.execute(
        state.primeResult.contextPath,
        epic,
        state.primeResult
      );
      state.planResult = planResult;
      console.log('[PIV] Plan phase complete');

      // Phase 3: Execute (Implementation)
      console.log('[PIV] Phase 3: Execute (Implementation)');
      state.currentPhase = 'execute';

      if (!state.planResult) {
        throw new Error('Plan result is required for Execute phase');
      }

      const executeResult = await this.executePhase.execute(
        state.planResult,
        epic.id,
        project.name
      );
      state.executeResult = executeResult;

      if (executeResult.success) {
        console.log('[PIV] Execute phase complete');
        state.currentPhase = 'complete';
      } else {
        console.error('[PIV] Execute phase failed:', executeResult.errorMessage);
        state.currentPhase = 'failed';
        state.error = executeResult.errorMessage;
      }

      state.completedAt = new Date();
      return state;
    } catch (error) {
      state.currentPhase = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      state.completedAt = new Date();
      console.error('[PIV] Loop failed:', state.error);
      return state;
    }
  }

  /**
   * Run only Prime phase (for analysis)
   */
  async runPrimeOnly(project: ProjectContext, epic: Epic): Promise<PrimeResult> {
    return await this.primePhase.execute(project, epic);
  }

  /**
   * Run only Plan phase (requires Prime result)
   */
  async runPlanOnly(
    contextPath: string,
    epic: Epic,
    primeResult: PrimeResult
  ): Promise<PlanResult> {
    return await this.planPhase.execute(contextPath, epic, primeResult);
  }

  /**
   * Run only Execute phase (requires Plan result)
   */
  async runExecuteOnly(
    planResult: PlanResult,
    epicId: string,
    projectName: string
  ): Promise<ExecuteResult> {
    return await this.executePhase.execute(planResult, epicId, projectName);
  }

  /**
   * Get current PIV state (useful for monitoring)
   */
  getState(): PIVState | null {
    // In production, this would return the current state from memory or database
    return null;
  }
}
