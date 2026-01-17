import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { ToolContext } from '../server';

const execAsync = promisify(exec);

const SUPERVISOR_ROOT = '/home/samuel/supervisor';

export function registerGitTools(context: ToolContext): void {
  context.registerTool(
    {
      name: 'git_status',
      description: 'Get git status for project planning directory',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
        },
        required: ['project'],
      },
    },
    async (args: any) => {
      const projectPath = join(SUPERVISOR_ROOT, args.project);
      
      try {
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: projectPath,
        });
        
        const { stdout: branch } = await execAsync('git branch --show-current', {
          cwd: projectPath,
        });
        
        return {
          success: true,
          project: args.project,
          branch: branch.trim(),
          status: stdout,
          has_changes: stdout.length > 0,
        };
      } catch (error) {
        throw new Error('Failed to get git status: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'git_commit',
      description: 'Create git commit in project planning directory',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          message: {
            type: 'string',
            description: 'Commit message',
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files to commit (optional, commits all if not specified)',
          },
        },
        required: ['project', 'message'],
      },
    },
    async (args: any) => {
      const projectPath = join(SUPERVISOR_ROOT, args.project);
      
      try {
        if (args.files && args.files.length > 0) {
          for (const file of args.files) {
            await execAsync('git add "' + file + '"', {
              cwd: projectPath,
            });
          }
        } else {
          await execAsync('git add .', {
            cwd: projectPath,
          });
        }
        
        const escapedMessage = args.message.replace(/"/g, '\\"');
        const { stdout } = await execAsync('git commit -m "' + escapedMessage + '"', {
          cwd: projectPath,
        });
        
        return {
          success: true,
          project: args.project,
          message: args.message,
          output: stdout,
        };
      } catch (error) {
        throw new Error('Failed to commit: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'git_push',
      description: 'Push commits to remote repository',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          remote: {
            type: 'string',
            description: 'Remote name (default: origin)',
            default: 'origin',
          },
          branch: {
            type: 'string',
            description: 'Branch name (default: current branch)',
          },
        },
        required: ['project'],
      },
    },
    async (args: any) => {
      const projectPath = join(SUPERVISOR_ROOT, args.project);
      
      try {
        const remote = args.remote || 'origin';
        let pushCommand = 'git push ' + remote;
        
        if (args.branch) {
          pushCommand += ' ' + args.branch;
        }
        
        const { stdout, stderr } = await execAsync(pushCommand, {
          cwd: projectPath,
        });
        
        return {
          success: true,
          project: args.project,
          remote,
          output: stdout + stderr,
        };
      } catch (error) {
        throw new Error('Failed to push: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'git_log',
      description: 'Get recent git commits',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          limit: {
            type: 'number',
            description: 'Number of commits to retrieve (default: 10)',
            default: 10,
          },
        },
        required: ['project'],
      },
    },
    async (args: any) => {
      const projectPath = join(SUPERVISOR_ROOT, args.project);
      const limit = args.limit || 10;
      
      try {
        const { stdout } = await execAsync(
          'git log -' + limit + ' --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso',
          {
            cwd: projectPath,
          }
        );
        
        const commits = stdout.split('\n').filter(l => l).map(line => {
          const parts = line.split('|');
          return {
            hash: parts[0],
            author: parts[1],
            email: parts[2],
            date: parts[3],
            message: parts.slice(4).join('|'),
          };
        });
        
        return {
          success: true,
          project: args.project,
          count: commits.length,
          commits,
        };
      } catch (error) {
        throw new Error('Failed to get git log: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );
}
