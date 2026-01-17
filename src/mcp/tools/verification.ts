import { ToolContext } from '../server';
import { VerificationRunner } from '../../verification/VerificationRunner';
import { join } from 'path';

const WORKTREE_ROOT = '/home/samuel/.archon/worktrees';

export function registerVerificationTools(context: ToolContext): void {
  const verifier = new VerificationRunner(context.pool);

  context.registerTool(
    {
      name: 'trigger_verification',
      description: 'Manually trigger verification for an issue',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const workspaceRoot = join(WORKTREE_ROOT, args.project, 'issue-' + args.issue_number);
        
        const result = await verifier.runVerification({
          projectName: args.project,
          issueNumber: args.issue_number,
          workspaceRoot,
        });
        
        return {
          success: true,
          verification_id: result.id,
          status: result.status,
          build_success: result.buildSuccess,
          tests_passed: result.testsPassed,
          mocks_detected: result.mocksDetected,
          summary: result.details.summary,
        };
      } catch (error) {
        throw new Error('Failed to trigger verification: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'get_verification_results',
      description: 'Get latest verification results for an issue',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
          limit: {
            type: 'number',
            description: 'Number of results to retrieve (default: 5)',
            default: 5,
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const results = await verifier.getResultsForIssue(args.project, args.issue_number);
        const limit = args.limit || 5;
        
        return {
          success: true,
          project: args.project,
          issue_number: args.issue_number,
          count: results.length,
          results: results.slice(0, limit).map((r: any) => ({
            id: r.id,
            status: r.status,
            build_success: r.build_success,
            tests_passed: r.tests_passed,
            mocks_detected: r.mocks_detected,
            created_at: r.created_at,
          })),
        };
      } catch (error) {
        throw new Error('Failed to get verification results: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'run_build',
      description: 'Run build in worktree',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const workspaceRoot = join(WORKTREE_ROOT, args.project, 'issue-' + args.issue_number);
        
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
          const { stdout, stderr } = await execAsync('npm run build', {
            cwd: workspaceRoot,
            timeout: 120000,
            maxBuffer: 1024 * 1024 * 10,
          });
          
          return {
            success: true,
            build_success: true,
            output: stdout,
            stderr: stderr || '',
          };
        } catch (error: any) {
          return {
            success: true,
            build_success: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
          };
        }
      } catch (error) {
        throw new Error('Failed to run build: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'run_tests',
      description: 'Run tests in worktree',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          issue_number: {
            type: 'number',
            description: 'Issue number',
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const workspaceRoot = join(WORKTREE_ROOT, args.project, 'issue-' + args.issue_number);
        
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
          const { stdout, stderr } = await execAsync('npm test', {
            cwd: workspaceRoot,
            timeout: 300000,
            maxBuffer: 1024 * 1024 * 10,
          });
          
          return {
            success: true,
            tests_passed: true,
            output: stdout,
            stderr: stderr || '',
          };
        } catch (error: any) {
          return {
            success: true,
            tests_passed: false,
            output: error.stdout || '',
            error: error.stderr || error.message,
          };
        }
      } catch (error) {
        throw new Error('Failed to run tests: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );
}
