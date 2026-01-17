import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolContext } from '../server';

const execAsync = promisify(exec);

const WORKTREE_ROOT = '/home/samuel/.archon/worktrees';

export function registerScarTools(context: ToolContext): void {
  context.registerTool(
    {
      name: 'check_scar_progress',
      description: 'Check SCAR\'s latest activity on an issue',
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: 'Project name',
          },
          issue_number: {
            type: 'number',
            description: 'GitHub issue number',
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const worktreePath = join(WORKTREE_ROOT, args.project, 'issue-' + args.issue_number);
        
        try {
          await stat(worktreePath);
        } catch {
          return {
            success: true,
            project: args.project,
            issue_number: args.issue_number,
            status: 'not_started',
            message: 'SCAR has not started work on this issue yet',
          };
        }
        
        const { stdout: findOutput } = await execAsync(
          'find . -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | head -20',
          { cwd: worktreePath }
        );
        
        const files = findOutput.trim().split('\n').filter(f => f);
        
        if (files.length === 0) {
          return {
            success: true,
            project: args.project,
            issue_number: args.issue_number,
            status: 'started',
            message: 'Worktree exists but no files created yet',
          };
        }
        
        const fileStats = await Promise.all(
          files.slice(0, 10).map(async (file) => {
            const filePath = join(worktreePath, file);
            const stats = await stat(filePath);
            return {
              file,
              modified: stats.mtime,
            };
          })
        );
        
        fileStats.sort((a, b) => b.modified.getTime() - a.modified.getTime());
        
        const mostRecent = fileStats[0];
        const minutesAgo = Math.floor((Date.now() - mostRecent.modified.getTime()) / 60000);
        
        return {
          success: true,
          project: args.project,
          issue_number: args.issue_number,
          status: 'in_progress',
          files_count: files.length,
          last_activity: {
            file: mostRecent.file,
            modified: mostRecent.modified.toISOString(),
            minutes_ago: minutesAgo,
          },
        };
      } catch (error) {
        throw new Error('Failed to check SCAR progress: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'list_worktrees',
      description: 'List active worktrees for a project',
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
      try {
        const projectPath = join(WORKTREE_ROOT, args.project);
        
        try {
          const dirs = await readdir(projectPath);
          const worktrees = dirs.filter(d => d.startsWith('issue-'));
          
          const worktreeInfo = await Promise.all(
            worktrees.map(async (dir) => {
              const worktreePath = join(projectPath, dir);
              const stats = await stat(worktreePath);
              const issueNumber = parseInt(dir.replace('issue-', ''));
              
              return {
                issue_number: issueNumber,
                path: worktreePath,
                created: stats.birthtime || stats.ctime,
                modified: stats.mtime,
              };
            })
          );
          
          return {
            success: true,
            project: args.project,
            count: worktrees.length,
            worktrees: worktreeInfo,
          };
        } catch {
          return {
            success: true,
            project: args.project,
            count: 0,
            worktrees: [],
          };
        }
      } catch (error) {
        throw new Error('Failed to list worktrees: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'read_worktree_files',
      description: 'List files in a worktree',
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
          pattern: {
            type: 'string',
            description: 'File pattern (optional, e.g., "*.ts")',
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const worktreePath = join(WORKTREE_ROOT, args.project, 'issue-' + args.issue_number);
        
        let findCommand = 'find . -type f';
        
        if (args.pattern) {
          findCommand += ' -name "' + args.pattern + '"';
        }
        
        const { stdout } = await execAsync(findCommand, {
          cwd: worktreePath,
          maxBuffer: 1024 * 1024 * 5,
        });
        
        const files = stdout.trim().split('\n').filter(f => f && !f.includes('node_modules'));
        
        return {
          success: true,
          project: args.project,
          issue_number: args.issue_number,
          count: files.length,
          files: files.slice(0, 100),
        };
      } catch (error) {
        throw new Error('Failed to read worktree files: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );

  context.registerTool(
    {
      name: 'check_file_timestamps',
      description: 'Get file modification times in worktree',
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
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific files to check (relative paths)',
          },
        },
        required: ['project', 'issue_number'],
      },
    },
    async (args: any) => {
      try {
        const worktreePath = join(WORKTREE_ROOT, args.project, 'issue-' + args.issue_number);
        
        let filesToCheck: string[] = [];
        
        if (args.files && args.files.length > 0) {
          filesToCheck = args.files;
        } else {
          const { stdout } = await execAsync(
            'find . -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \\) | head -50',
            { cwd: worktreePath }
          );
          filesToCheck = stdout.trim().split('\n').filter(f => f);
        }
        
        const timestamps = await Promise.all(
          filesToCheck.map(async (file) => {
            try {
              const filePath = join(worktreePath, file);
              const stats = await stat(filePath);
              
              return {
                file,
                modified: stats.mtime.toISOString(),
                size: stats.size,
                minutes_ago: Math.floor((Date.now() - stats.mtime.getTime()) / 60000),
              };
            } catch {
              return {
                file,
                error: 'File not found',
              };
            }
          })
        );
        
        return {
          success: true,
          project: args.project,
          issue_number: args.issue_number,
          timestamps,
        };
      } catch (error) {
        throw new Error('Failed to check timestamps: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  );
}
